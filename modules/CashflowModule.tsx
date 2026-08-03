import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCashflow } from '../hooks/useCashflow';
import { useQuotes } from '../hooks/useQuotes';
import { CashflowModal } from './CashflowModal';
import { User, Quote } from '../utils/types';
import { CashflowEntry } from '../cashflowTypes';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { MonthlyClosingView } from './MonthlyClosingView';
import { FixedExpensesView } from './finance/components/FixedExpensesView';
import { ModulePage } from '../components/ui/ModulePage';
import { formatCurrency } from '../utils/formatCurrency';
import { getYearFromDateString } from '../utils/dateUtils';
// Design System
import { Toolbar, ActionButton, IconButton, ACTION_ICONS, DataTable, TableColumn, SearchInput } from '../design-system';
import { FiLock, FiList, FiRefreshCw, FiFileText, FiTrash2, FiLoader, FiAlertTriangle, FiUploadCloud } from "react-icons/fi";
import { CashflowImportWizard } from './finance/cashflow/import/CashflowImportWizard';

interface CashflowModuleProps {
  currentUser: User;
  selectedId?: string;
  onClearSelectedId?: () => void;
}

const defaultIsDateClosed = (_d: string) => false;

const MovimientosFinancieros: React.FC<CashflowModuleProps> = ({ currentUser, selectedId, onClearSelectedId }) => {
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString());
  
  const cashflowHook = useCashflow(currentUser, filterYear, filterMonth);
  const entries = useMemo(() => Array.isArray(cashflowHook?.entries) ? cashflowHook.entries : [], [cashflowHook?.entries]);
  const allEntries = useMemo(() => Array.isArray(cashflowHook?.allEntries) ? cashflowHook.allEntries : [], [cashflowHook?.allEntries]);
  const isLoading = cashflowHook?.isLoading || false;
  
  // Paginación Props
  const isLoadingMore = cashflowHook?.isLoadingMore || false;
  const hasMore = cashflowHook?.hasMore || false;
  const loadMore = cashflowHook?.loadMore || (async () => {});
  const clientPage = cashflowHook?.clientPage || 1;

  const addCashflowEntry = cashflowHook?.addCashflowEntry || (async () => {});
  const updateCashflowEntry = cashflowHook?.updateCashflowEntry || (async () => {});
  const deleteCashflowEntry = cashflowHook?.deleteCashflowEntry || (async () => {});
  const isDateClosed = cashflowHook?.isDateClosed || defaultIsDateClosed;

  const quotesHook = useQuotes(currentUser);
  const quotes = useMemo(() => Array.isArray(quotesHook?.quotes) ? quotesHook.quotes : [], [quotesHook?.quotes]);
  
  // Estado de Tabs: 'list' (Movimientos) | 'closing' (Cierre Mensual) | 'fixed-expenses' (Gastos Fijos)
  const [activeTab, setActiveTab] = useState<'list' | 'closing' | 'fixed-expenses'>('list');

  const [showModal, setShowModal] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashflowEntry | null>(null);

  // --- AUTO-OPEN AND HIGHLIGHT FROM SEARCH ---
  const autoOpenedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (selectedId && entries.length > 0) {
      if (autoOpenedIdRef.current !== selectedId) {
        const target = entries.find(e => e.id === selectedId);
        if (target) {
          autoOpenedIdRef.current = selectedId;
          setEditingEntry(target);
          setShowModal(true);
        }
      }
    }
  }, [selectedId, entries]);
  const [filterCurrency, setFilterCurrency] = useState<'CRC' | 'USD' | 'AMBAS'>('CRC');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, entry: CashflowEntry | null }>({ show: false, entry: null });



  // Estado para el modal crítico de eliminación controlada (Nivel ERP)
  const [criticalDeleteModal, setCriticalDeleteModal] = useState<{ 
      show: boolean; 
      entry: CashflowEntry | null;
      quote: Quote | null;
      isProcessing: boolean;
      confirmedCheckbox: boolean;
  }>({ show: false, entry: null, quote: null, isProcessing: false, confirmedCheckbox: false });

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  // Grid Layout Definition para Consistencia
  const gridTemplate = "grid grid-cols-12 gap-2 items-center px-4";
  const headerClass = "text-slate-700 text-xs font-black uppercase tracking-widest py-3";
  const headerCenterClass = headerClass + " text-center";

  // Verificar si el periodo seleccionado en los filtros está cerrado (para alerta visual)
  const isCurrentFilterClosed = useMemo(() => {
      if (filterYear !== 'all' && filterMonth !== 'all') {
          const dateStr = `${filterYear}-${filterMonth.padStart(2, '0')}-01`;
          return isDateClosed(dateStr);
      }
      return false;
  }, [filterYear, filterMonth, isDateClosed]);

  const renderDate = (dateStr: string) => {
      if (!dateStr || typeof dateStr !== 'string') return '---';
      try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr; 
          return date.toLocaleDateString('es-CR', { timeZone: 'UTC' });
      } catch (e) {
          return '---';
      }
  };

  const years = useMemo(() => {
    try {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [new Date().getFullYear().toString()];
        }
        const uniqueYears = new Set<string>();
        entries.forEach(e => {
            if (e && typeof e.date === 'string' && e.date.length >= 4) {
                uniqueYears.add(e.date.substring(0, 4));
            }
        });
        const sorted = Array.from(uniqueYears).sort((a,b) => String(b).localeCompare(String(a)));
        return sorted.length > 0 ? sorted : [new Date().getFullYear().toString()];
    } catch (e) {
        return [new Date().getFullYear().toString()];
    }
  }, [entries]);

  const filteredEntries = useMemo(() => {
    // Si hay un ID seleccionado de la búsqueda y tenemos datos
    if (selectedId && (allEntries.length > 0 || entries.length > 0)) {
      const target = allEntries.find(e => e.id === selectedId) || entries.find(e => e.id === selectedId);
      if (target) return [target];
      // Si no se encuentra, mostramos la lista completa (fallback)
    }

    const sourceData = (searchTerm && allEntries.length > 0) ? allEntries : entries;
    if (!Array.isArray(sourceData)) return [];
    
    // Ensure unique entries by ID
    const uniqueSourceData = Array.from(new Map(sourceData.map(item => [item.id, item])).values());

    return uniqueSourceData.filter(entry => {
      try {
        if (!entry || !entry.date) return false;
        
        const dateParts = entry.date.split('-');
        if (dateParts.length < 2) return false;

        const entryYear = dateParts[0];
        const monthNum = parseInt(dateParts[1], 10);
        if (isNaN(monthNum)) return false;

        const entryMonth = monthNum.toString();
        const yearMatch = filterYear === 'all' || entryYear === filterYear;
        const monthMatch = filterMonth === 'all' || entryMonth === filterMonth;
        const currencyMatch = filterCurrency === 'AMBAS' ? true : entry.currency === filterCurrency;

        const term = searchTerm.toLowerCase();
        let projectMatch = false;
        if (entry.projectId) {
            const linkedQuote = quotes.find(q => q.id.toString() === entry.projectId);
            if (linkedQuote) {
                const formattedQuote = `#${linkedQuote.id.toString().padStart(3, '0')}-${getYearFromDateString(linkedQuote.fecha)}`;
                projectMatch = linkedQuote.empresa.toLowerCase().includes(term) || 
                               linkedQuote.id.toString().includes(term) ||
                               formattedQuote.toLowerCase().includes(term);
            }
        }

        const searchMatch = !searchTerm || 
            entry.description.toLowerCase().includes(term) || 
            entry.type.toLowerCase().includes(term) ||
            (entry.subtype && entry.subtype.toLowerCase().includes(term)) ||
            (entry.invoice && entry.invoice.toLowerCase().includes(term)) ||
            projectMatch;

        return yearMatch && monthMatch && currencyMatch && searchMatch;
      } catch (e) {
        return false;
      }
    });
  }, [entries, allEntries, filterYear, filterMonth, filterCurrency, searchTerm, quotes, selectedId]);
  
  // Paginación visual para resultados de búsqueda
  const visibleEntries = useMemo(() => {
      if (searchTerm && allEntries.length > 0) {
          // Si estamos buscando, aplicamos paginación sobre el resultado filtrado completo
          // Usamos clientPage del hook para mantener sincronía con el botón "Cargar más"
          const PAGE_SIZE = 20; // Debe coincidir con el hook
          const limit = (clientPage || 1) * PAGE_SIZE;
          return filteredEntries.slice(0, limit);
      }
      // Si no estamos buscando, usamos los entries que ya vienen paginados del hook
      return filteredEntries;
  }, [filteredEntries, searchTerm, allEntries, clientPage]);

  const effectiveHasMore = useMemo(() => {
      if (searchTerm && allEntries.length > 0) {
          const PAGE_SIZE = 20;
          const limit = (clientPage || 1) * PAGE_SIZE;
          return filteredEntries.length > limit;
      }
      return hasMore;
  }, [searchTerm, allEntries, filteredEntries, clientPage, hasMore]);

  const totals = useMemo(() => {
    const acc = {
        CRC: { ingresos: 0, gastos: 0, costos: 0 },
        USD: { ingresos: 0, gastos: 0, costos: 0 }
    };
    if (!Array.isArray(filteredEntries)) return acc;
    
    filteredEntries.forEach(entry => {
      try {
        if (!entry) return;
        const val = Number(entry.amount) || 0;
        const curr = entry.currency === 'USD' ? 'USD' : 'CRC';
        
        if (entry.type === 'Ingreso') {
            acc[curr].ingresos += val;
        } else { 
            if (entry.subtype === 'Costo de Proyecto') {
            acc[curr].costos += val;
            } else {
            acc[curr].gastos += val;
            }
        }
      } catch (e) {
        console.error("Error processing entry", e);
      }
    });
    return acc;
  }, [filteredEntries]);

  const balanceCRC = totals.CRC.ingresos - (totals.CRC.gastos + totals.CRC.costos);
  const balanceUSD = totals.USD.ingresos - (totals.USD.gastos + totals.USD.costos);

  const handleExportExcel = () => {
    const dataToExport = filteredEntries.map(entry => {
        const linkedQuote = entry.projectId ? quotes.find(q => q.id.toString() === entry.projectId) : null;
        const projectLabel = linkedQuote ? `Cot #${linkedQuote.id.toString().padStart(3, '0')}-${getYearFromDateString(linkedQuote.fecha)} - ${linkedQuote.empresa}` : '---';
        return {
            "Fecha": entry.date,
            "Tipo": entry.type,
            "Categoría": entry.subtype || 'N/A',
            "Descripción": entry.description,
            "Proyecto/Cotización": projectLabel,
            "Moneda": entry.currency,
            "Monto": entry.amount
        };
    });
    exportToExcel(dataToExport, `Movimientos_${filterCurrency}_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  };

  const handleExportPDF = () => {
    const formatNumberForPDF = (amount: number) => {
        return new Intl.NumberFormat('es-CR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
        }).format(amount);
    };

    if (filterCurrency === 'AMBAS') {
        const dataToExport = filteredEntries.map(entry => {
            const linkedQuote = entry.projectId ? quotes.find(q => q.id.toString() === entry.projectId) : null;
            const projectLabel = linkedQuote ? `#${linkedQuote.id.toString().padStart(3, '0')}-${getYearFromDateString(linkedQuote.fecha)} ${linkedQuote.empresa}` : '-';
            return {
                date: entry.date,
                invoice: entry.invoice || '---',
                desc: entry.description,
                project: projectLabel,
                currency: entry.currency,
                amount: formatNumberForPDF(entry.amount)
            };
        });

        exportToPDF({
            title: "Reporte de Movimientos Financieros",
            subtitle: `Moneda: AMBAS | Periodo: ${filterYear} / ${filterMonth === 'all' ? 'Todos' : monthNames[parseInt(filterMonth)-1]}`,
            fileName: `Movimientos_AMBAS_${new Date().toLocaleDateString().replace(/\//g, '-')}`,
            orientation: 'p',
            columns: [
                { header: "Fecha", dataKey: "date", width: 1.5, align: 'left' },
                { header: "Factura", dataKey: "invoice", width: 1.2, align: 'center' },
                { header: "Proyecto", dataKey: "project", width: 1.8, align: 'left' }, 
                { header: "Descripción", dataKey: "desc", width: 2.5, align: 'left' },
                { header: "Moneda", dataKey: "currency", width: 1.0, align: 'center' },
                { header: "Monto", dataKey: "amount", width: 4.0, align: 'right', isCurrency: true }, 
            ],
            data: dataToExport,
            totals: {
                "Total Ingresos CRC": formatNumberForPDF(totals.CRC.ingresos),
                "Total Gastos CRC": formatNumberForPDF(totals.CRC.gastos + totals.CRC.costos),
                "Balance CRC": formatNumberForPDF(balanceCRC),
                "------------------": "------------------",
                "Total Ingresos USD": formatNumberForPDF(totals.USD.ingresos),
                "Total Gastos USD": formatNumberForPDF(totals.USD.gastos + totals.USD.costos),
                "Balance USD": formatNumberForPDF(balanceUSD)
            }
        });
        return;
    }

    const dataToExport = filteredEntries.map(entry => {
        const linkedQuote = entry.projectId ? quotes.find(q => q.id.toString() === entry.projectId) : null;
        const projectLabel = linkedQuote ? `#${linkedQuote.id.toString().padStart(3, '0')}-${getYearFromDateString(linkedQuote.fecha)} ${linkedQuote.empresa}` : '-';
        return {
            date: entry.date,
            invoice: entry.invoice || '---',
            desc: entry.description,
            project: projectLabel,
            amount: formatNumberForPDF(entry.amount)
        };
    });

    exportToPDF({
        title: "Reporte de Movimientos Financieros",
        subtitle: `Moneda: ${filterCurrency} | Periodo: ${filterYear} / ${filterMonth === 'all' ? 'Todos' : monthNames[parseInt(filterMonth)-1]}`,
        fileName: `Movimientos_${filterCurrency}_${new Date().toLocaleDateString().replace(/\//g, '-')}`,
        orientation: 'p',
        columns: [
            { header: "Fecha", dataKey: "date", width: 1.5, align: 'left' },
            { header: "Factura", dataKey: "invoice", width: 1.2, align: 'center' },
            { header: "Proyecto", dataKey: "project", width: 1.8, align: 'left' }, 
            { header: "Descripción", dataKey: "desc", width: 2.5, align: 'left' },
            { header: "Monto", dataKey: "amount", width: 4.0, align: 'right', isCurrency: true }, 
        ],
        data: dataToExport,
        totals: {
            "Total Ingresos": formatNumberForPDF((filterCurrency === 'USD' ? totals.USD : totals.CRC).ingresos),
            "Total Egresos": formatNumberForPDF((filterCurrency === 'USD' ? totals.USD : totals.CRC).gastos + (filterCurrency === 'USD' ? totals.USD : totals.CRC).costos),
            "Balance Neto": formatNumberForPDF(filterCurrency === 'USD' ? balanceUSD : balanceCRC)
        }
    });
  };

  const handleDelete = useCallback((entry: CashflowEntry) => {
    if (isDateClosed(entry.date)) {
        alert("No se puede eliminar un movimiento de un mes cerrado.");
        return;
    }

    if (entry.projectId) {
        const linkedQuote = quotes.find(q => q.id.toString() === entry.projectId);
        setCriticalDeleteModal({ 
            show: true, 
            entry, 
            quote: linkedQuote || null, 
            isProcessing: false, 
            confirmedCheckbox: false 
        });
        return;
    }

    if (entry && entry.id) {
        setConfirmModal({ show: true, entry });
    }
  }, [isDateClosed, quotes]);

  const confirmDelete = () => {
    if (confirmModal.entry && confirmModal.entry.id) {
      deleteCashflowEntry(confirmModal.entry.id);
    }
    setConfirmModal({ show: false, entry: null });
  };

  const confirmCriticalDelete = async () => {
      if (!criticalDeleteModal.entry) return;
      
      setCriticalDeleteModal(prev => ({ ...prev, isProcessing: true }));
      try {
          await deleteCashflowEntry(criticalDeleteModal.entry.id);
          setCriticalDeleteModal({ show: false, entry: null, quote: null, isProcessing: false, confirmedCheckbox: false });
      } catch (error) {
          console.error("Error deleting entry:", error);
          setCriticalDeleteModal(prev => ({ ...prev, isProcessing: false }));
      }
  };

  const handleEdit = useCallback((entry: CashflowEntry) => {
      if (isDateClosed(entry.date)) {
          alert("No se puede editar un movimiento de un mes cerrado.");
          return;
      }
      setEditingEntry(entry);
      setShowModal(true);
  }, [isDateClosed]);

  const handleModalClose = () => {
    setShowModal(false);
    setEditingEntry(null);
    onClearSelectedId?.();
  };

  const handleModalSubmit = async (data: Omit<CashflowEntry, 'id' | 'createdAt'>) => {
    if (editingEntry) {
      await updateCashflowEntry(editingEntry.id, data);
    } else {
      await addCashflowEntry(data);
    }
    handleModalClose();
  };

  const renderRow = ({ item: entry, index }: { item: CashflowEntry, index: number }) => {
    const linkedQuote = entry.projectId ? quotes.find(q => q.id.toString() === entry.projectId) : null;
    const isClosed = isDateClosed(entry.date);
    
    return (
      <div key={entry.id || index} className={`border-b border-slate-100 flex items-center min-h-[50px] ${isClosed ? 'bg-slate-50 opacity-80' : 'hover:bg-blue-50/20'}`}>
        <div className={`${gridTemplate} w-full h-full text-[11px] py-3`}>
          <div className="col-span-2 font-bold text-slate-600 flex items-center gap-2">
            <div className="flex flex-col">
                <span className="text-xs text-blue-950 font-black">{entry.invoice || '---'}</span>
                <span className="text-[10px] text-slate-400">{renderDate(entry.date)}</span>
            </div>
            {isClosed && <FiLock className="text-slate-300" title="Mes Cerrado" />}
          </div>
          <div className="col-span-2">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tight ${entry.type === 'Ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{entry.type || 'Egreso'}</span>
            {entry.subtype && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5 truncate">{entry.subtype}</p>}
          </div>
          <div className="col-span-3">
            {linkedQuote ? (
                <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-black border border-blue-100 whitespace-nowrap">#{linkedQuote.id.toString().padStart(3, '0')}-{getYearFromDateString(linkedQuote.fecha)}</span>
                    <span className="text-[10px] font-bold text-blue-900 truncate block max-w-full" title={linkedQuote.empresa}>{linkedQuote.empresa}</span>
                </div>
            ) : (
                <span className="text-slate-300 font-bold text-[9px]">---</span>
            )}
          </div>
          <div className="col-span-3">
            <p className="font-bold text-blue-900 truncate" title={entry.description}>{entry.description || 'Sin descripción'}</p>
          </div>
          <div className={`col-span-1 text-center font-mono font-black ${entry.type === 'Ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(entry.amount || 0, entry.currency)}
          </div>
          <div className="col-span-1 flex justify-center gap-2">
            <IconButton icon={<ACTION_ICONS.edit />} variant="primary" onClick={() => handleEdit(entry)} disabled={isClosed} title={isClosed ? "Mes Cerrado" : "Editar"} />
            <IconButton icon={<ACTION_ICONS.delete />} variant="danger" onClick={() => handleDelete(entry)} disabled={isClosed} title={isClosed ? "Mes Cerrado" : "Eliminar"} />
          </div>
        </div>
      </div>
    );
  };

  const columns = useMemo<TableColumn<CashflowEntry>[]>(() => [
    {
        header: "Factura",
        width: "100px",
        mobileGrid: "full",
        mobileOrder: 1,
        render: (entry) => (
            <div className="flex flex-col">
                <span className="text-xs text-blue-950 font-black">{entry.invoice || '---'}</span>
                <span className="text-[10px] text-slate-400">{renderDate(entry.date)}</span>
            </div>
        )
    },
    {
        header: "Tipo",
        width: "100px",
        mobileGrid: "left",
        mobileOrder: 2,
        render: (entry) => (
            <div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tight ${entry.type === 'Ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{entry.type || 'Egreso'}</span>
                {entry.subtype && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5 truncate">{entry.subtype}</p>}
            </div>
        )
    },
    {
        header: "Cotización",
        width: "100px",
        mobileGrid: "left",
        mobileOrder: 3,
        render: (entry) => {
            const linkedQuote = entry.projectId ? quotes.find(q => q.id.toString() === entry.projectId) : null;
            return linkedQuote ? (
                <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-black border border-blue-100 whitespace-nowrap">#{linkedQuote.id.toString().padStart(3, '0')}-{getYearFromDateString(linkedQuote.fecha)}</span>
            ) : (
                <span className="text-slate-300 font-bold text-[9px]">---</span>
            );
        }
    },
    {
        header: "Proyecto",
        width: "150px",
        mobileGrid: "full",
        mobileOrder: 4,
        render: (entry) => {
            const linkedQuote = entry.projectId ? quotes.find(q => q.id.toString() === entry.projectId) : null;
            return linkedQuote ? (
                <span className="text-[10px] font-bold text-blue-900 truncate block max-w-full" title={linkedQuote.empresa}>{linkedQuote.empresa}</span>
            ) : (
                <span className="text-slate-300 font-bold text-[9px]">---</span>
            );
        }
    },
    {
        header: "Descripción",
        mobileGrid: "full",
        mobileOrder: 5,
        render: (entry) => (
            <p className="font-bold text-blue-900 truncate min-w-0 max-w-[300px]" title={entry.description}>{entry.description || 'Sin descripción'}</p>
        )
    },
    {
        header: "Monto",
        width: "120px",
        align: "right",
        mobileGrid: "right",
        mobileOrder: 6,
        render: (entry) => (
            <span className={`font-mono font-black whitespace-nowrap ${entry.type === 'Ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(entry.amount || 0, entry.currency)}
            </span>
        )
    },
    {
        header: "Acciones",
        width: "100px",
        align: "center",
        mobileGrid: "full",
        mobileOrder: 7,
        render: (entry) => {
            const isClosed = isDateClosed(entry.date);
            return (
                <div className="flex justify-center gap-2">
                    <IconButton icon={<ACTION_ICONS.edit />} variant="primary" onClick={() => handleEdit(entry)} disabled={isClosed} title={isClosed ? "Mes Cerrado" : "Editar"} />
                    <IconButton icon={<ACTION_ICONS.delete />} variant="danger" onClick={() => handleDelete(entry)} disabled={isClosed} title={isClosed ? "Mes Cerrado" : "Eliminar"} />
                </div>
            );
        }
    }
  ], [quotes, isDateClosed, handleEdit, handleDelete]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage 
        title="Movimientos Financieros" 
        subtitle="Registro de ingresos, costos y gastos."
      >
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                    <ActionButton 
    label="Listado" 
    icon={<FiList />}
    onClick={() => setActiveTab('list')} 
    variant={activeTab === 'list' ? 'primary' : 'secondary'}
/>
<ActionButton 
    label="Cierre Mensual" 
    icon={<FiLock />}
    onClick={() => setActiveTab('closing')} 
    variant={activeTab === 'closing' ? 'primary' : 'secondary'}
/>
<ActionButton 
    label="Gastos Fijos" 
    icon={<FiRefreshCw />}
    onClick={() => setActiveTab('fixed-expenses')} 
    variant={activeTab === 'fixed-expenses' ? 'primary' : 'secondary'}
/>
                </div>
                
                {activeTab === 'list' && (
                  <div className="flex gap-2">
                    <ActionButton 
                      onClick={() => setShowImportWizard(true)} 
                      label="Importar Excel" 
                      variant="secondary" 
                      icon={<FiUploadCloud />} 
                    />
                    <ActionButton 
                      onClick={() => { setEditingEntry(null); setShowModal(true); }} 
                      disabled={isCurrentFilterClosed} 
                      label={isCurrentFilterClosed ? "Mes Cerrado" : "Nuevo Movimiento"} 
                      icon={isCurrentFilterClosed ? <FiLock  /> : undefined} 
                    />
                  </div>
                )}
            </div>

            {activeTab === 'closing' ? (
                <MonthlyClosingView currentUser={currentUser} />
            ) : activeTab === 'fixed-expenses' ? (
                <FixedExpensesView currentUser={currentUser} refreshCashflow={cashflowHook.refresh} />
            ) : (
                <div className="space-y-6">
                    <div>
                        {isCurrentFilterClosed && (
                            <div className="mb-6 bg-slate-100 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in">
                                <FiLock className="text-slate-400 text-lg"  />
                                <p className="text-xs font-bold text-slate-500">Visualizando periodo cerrado. No se permiten modificaciones.</p>
                            </div>
                        )}

                        <div className="mb-8">
                            {filterCurrency === 'AMBAS' ? (
                                <div className="space-y-3">
                                    {/* Bloque CRC Compacto */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">Ingresos (CRC)</p>
                                            <p className="text-lg font-black text-emerald-600">{formatCurrency(totals.CRC.ingresos, 'CRC')}</p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest">Gastos (CRC)</p>
                                            <p className="text-lg font-black text-amber-600">{formatCurrency(totals.CRC.gastos, 'CRC')}</p>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest">Costos (CRC)</p>
                                            <p className="text-lg font-black text-red-600">{formatCurrency(totals.CRC.costos, 'CRC')}</p>
                                        </div>
                                        <div className={`border rounded-xl p-3 ${balanceCRC >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}>
                                            <p className={`text-[9px] font-bold uppercase tracking-widest ${balanceCRC >= 0 ? 'text-blue-800' : 'text-rose-800'}`}>Balance (CRC)</p>
                                            <p className={`text-lg font-black ${balanceCRC >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(balanceCRC, 'CRC')}</p>
                                        </div>
                                    </div>

                                    {/* Bloque USD Compacto */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">Ingresos (USD)</p>
                                            <p className="text-lg font-black text-emerald-600">{formatCurrency(totals.USD.ingresos, 'USD')}</p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest">Gastos (USD)</p>
                                            <p className="text-lg font-black text-amber-600">{formatCurrency(totals.USD.gastos, 'USD')}</p>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest">Costos (USD)</p>
                                            <p className="text-lg font-black text-red-600">{formatCurrency(totals.USD.costos, 'USD')}</p>
                                        </div>
                                        <div className={`border rounded-xl p-3 ${balanceUSD >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}>
                                            <p className={`text-[9px] font-bold uppercase tracking-widest ${balanceUSD >= 0 ? 'text-blue-800' : 'text-rose-800'}`}>Balance (USD)</p>
                                            <p className={`text-lg font-black ${balanceUSD >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(balanceUSD, 'USD')}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                                        <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Ingresos ({filterCurrency})</p>
                                        <p className="text-xl font-black text-emerald-600">{formatCurrency(totals[filterCurrency === 'USD' ? 'USD' : 'CRC'].ingresos, filterCurrency)}</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Gastos ({filterCurrency})</p>
                                        <p className="text-xl font-black text-amber-600">{formatCurrency(totals[filterCurrency === 'USD' ? 'USD' : 'CRC'].gastos, filterCurrency)}</p>
                                    </div>
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                        <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest">Costos ({filterCurrency})</p>
                                        <p className="text-xl font-black text-red-600">{formatCurrency(totals[filterCurrency === 'USD' ? 'USD' : 'CRC'].costos, filterCurrency)}</p>
                                    </div>
                                    <div className={`border rounded-2xl p-4 ${(filterCurrency === 'USD' ? balanceUSD : balanceCRC) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${(filterCurrency === 'USD' ? balanceUSD : balanceCRC) >= 0 ? 'text-blue-800' : 'text-rose-800'}`}>Balance ({filterCurrency})</p>
                                        <p className={`text-xl font-black ${(filterCurrency === 'USD' ? balanceUSD : balanceCRC) >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency((filterCurrency === 'USD' ? balanceUSD : balanceCRC), filterCurrency)}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Toolbar
                            left={
                                <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto items-center">
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <ActionButton 
                                            onClick={() => setFilterCurrency('CRC')} 
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border-none shadow-none min-h-0 ${filterCurrency === 'CRC' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}
                                            variant="secondary"
                                            label="CRC"
                                        />
                                        <ActionButton 
                                            onClick={() => setFilterCurrency('USD')} 
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border-none shadow-none min-h-0 ${filterCurrency === 'USD' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}
                                            variant="secondary"
                                            label="USD"
                                        />
                                        <ActionButton 
                                            onClick={() => setFilterCurrency('AMBAS')} 
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border-none shadow-none min-h-0 ${filterCurrency === 'AMBAS' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}
                                            variant="secondary"
                                            label="AMBAS"
                                        />
                                    </div>
                                    <div className="w-px h-8 bg-slate-200 hidden md:block mx-1"></div>
                                {selectedId ? (
                                    <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-xl animate-in slide-in-from-top-2 duration-300">
                                        <span className="text-xs font-bold text-yellow-800">Mostrando resultado de búsqueda</span>
                                        <ActionButton 
                                            onClick={onClearSelectedId} 
                                            label="Ver todos" 
                                            variant="secondary" 
                                            className="h-7 px-3 text-[10px] bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full sm:w-auto flex-1 md:flex-none px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none">
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full sm:w-auto flex-1 md:flex-none px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none">
                                            <option value="all">Todo el Año</option>
                                            {monthNames.map((m, i) => <option key={m} value={(i+1).toString()}>{m}</option>)}
                                        </select>
                                    </>
                                )}
                                </div>
                            }
                            right={
                                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
                                    <SearchInput 
                                        placeholder="Buscar movimiento..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="flex-1 w-full sm:w-auto md:w-64 transition-all duration-300 focus-within:md:w-80 lg:focus-within:w-96 z-10"
                                    />
                                    <div className="flex gap-1 w-full sm:w-auto">
                                        <IconButton icon={<ACTION_ICONS.excel />} variant="success" onClick={handleExportExcel} title="Exportar Excel" />
                                        <IconButton icon={<ACTION_ICONS.pdf />} variant="danger" onClick={handleExportPDF} title="Exportar PDF" />
                                    </div>
                                </div>
                            }
                        />
                    </div>
                    
                    <div className="w-full">
                        <DataTable<CashflowEntry>
                            keyExtractor={(entry) => entry.id}
                            columns={columns}
                            data={visibleEntries}
                            isLoading={isLoading}
                            hasMore={effectiveHasMore}
                            onLoadMore={loadMore}
                            isLoadingMore={isLoadingMore}
                            enableVirtualization={true}
                            virtualHeight="600px"
                            emptyMessage={`No hay movimientos en ${filterCurrency} registrados.`}
                            rowClassName={(entry) => isDateClosed(entry.date) ? 'bg-slate-50 opacity-80' : ''}
                            highlightedId={selectedId}
                        />
                    </div>
                </div>
            )}
        </ModulePage>

        <CashflowModal 
            show={showModal} 
            onClose={handleModalClose} 
            onSubmit={handleModalSubmit} 
            quotes={quotes} 
            currentUser={currentUser} 
            initialData={editingEntry}
        />

        <CashflowImportWizard 
            isOpen={showImportWizard}
            onClose={() => setShowImportWizard(false)}
            quotes={quotes}
            existingEntries={allEntries}
            isDateClosed={isDateClosed}
            currentUser={currentUser}
            onSuccess={() => {
              setShowImportWizard(false);
              refresh();
            }}
        />
        
        {confirmModal.show && createPortal(
            <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[500] p-4">
            <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 text-center">
                <h3 className="text-xl font-black text-blue-950 mb-2">¿Eliminar Movimiento?</h3>
                <p className="text-slate-500 text-sm font-bold mb-8">Esta acción es permanente y no se puede deshacer.</p>
                <div className="flex gap-3">
                    <ActionButton 
                        label="Cancelar" 
                        onClick={() => setConfirmModal({ show: false, entry: null })} 
                        variant="secondary" 
                        className="flex-1 py-4 font-black uppercase text-xs text-slate-400 bg-transparent border-none shadow-none"
                    />
                    <ActionButton 
                        label="Confirmar" 
                        onClick={confirmDelete} 
                        variant="danger" 
                        className="flex-1 py-4 font-black uppercase rounded-2xl"
                    />
                </div>
            </div>
            </div>,
            document.body
        )}

        {criticalDeleteModal.show && createPortal(
            <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[500] p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 text-center border-4 border-red-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-lg shadow-red-100">
                    <FiAlertTriangle className="text-2xl animate-pulse"  />
                </div>

                <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">¡Atención! Acción Crítica</h3>
                
                <div className="bg-red-50 rounded-xl p-4 mb-6 text-left border border-red-100">
                    <p className="text-xs font-bold text-red-800 mb-2 uppercase tracking-wide">Registro Vinculado Detectado:</p>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                            <FiFileText  />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase">Proyecto / Cotización</p>
                            <p className="text-xs font-bold text-slate-700">
                                {criticalDeleteModal.quote ? `${criticalDeleteModal.quote.empresa} (#${criticalDeleteModal.quote.id})` : 'Proyecto Desconocido'}
                            </p>
                        </div>
                    </div>
                    <p className="text-[10px] font-medium text-red-600 mt-3 leading-relaxed">
                        Este movimiento financiero está vinculado a un proyecto activo. Eliminarlo afectará los reportes de rentabilidad y el balance del proyecto.
                    </p>
                </div>

                <label className="flex items-start gap-3 text-left bg-slate-50 p-4 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors border border-slate-200 mb-8 group">
                    <input 
                        type="checkbox" 
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        checked={criticalDeleteModal.confirmedCheckbox}
                        onChange={(e) => setCriticalDeleteModal(prev => ({ ...prev, confirmedCheckbox: e.target.checked }))}
                    />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors select-none">
                        Comprendo el riesgo y deseo eliminar este registro permanentemente.
                    </span>
                </label>

                <div className="flex gap-3">
                    <ActionButton 
                        onClick={() => setCriticalDeleteModal({ show: false, entry: null, quote: null, isProcessing: false, confirmedCheckbox: false })} 
                        className="flex-1 py-3.5 font-black uppercase text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all bg-transparent border-none shadow-none"
                        disabled={criticalDeleteModal.isProcessing}
                        variant="secondary"
                        label="Cancelar"
                    />
                    <ActionButton 
                        onClick={confirmCriticalDelete} 
                        disabled={!criticalDeleteModal.confirmedCheckbox || criticalDeleteModal.isProcessing}
                        className="flex-1 py-3.5 bg-red-600 text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                        variant="danger"
                        label={criticalDeleteModal.isProcessing ? "Eliminando..." : "Eliminar"}
                        icon={criticalDeleteModal.isProcessing ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                    />
                </div>
            </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default MovimientosFinancieros;
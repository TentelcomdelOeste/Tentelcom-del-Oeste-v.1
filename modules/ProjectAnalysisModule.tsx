import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCashflow } from '../hooks/useCashflow';
import { useQuotes } from '../hooks/useQuotes';
import { useInventory } from '../hooks/useInventory';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import { useMaterialReports } from '../hooks/useMaterialReports';
import { getTrabajos } from './job_scheduling/jobService';
import { Trabajo } from './job_scheduling/types';
import { User, Quote } from '../utils/types';
import { CashflowEntry } from '../cashflowTypes';
import { exportToExcel } from '../utils/exportUtils';
import { jsPDF } from 'jspdf';
import { renderDetailedFinancialLayout, DetailedFinancialReportData } from '../utils/pdf/pdfDetailedBaseLayout';
import { formatCurrency } from '../utils/formatCurrency';
import { getYearFromDateString } from '../utils/dateUtils';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Toolbar, IconButton, ActionButton, ACTION_ICONS, DataTable, TableColumn } from '../design-system';
import { FiAlertTriangle, FiPlus, FiInfo, FiSearch, FiX, FiCheck, FiAlertCircle, FiSave, FiFileText, FiDatabase, FiTrendingUp, FiBox, FiLoader, FiPieChart, FiActivity, FiHardDrive, FiTool } from "react-icons/fi";

interface ProjectAnalysisModuleProps {
  currentUser: User;
}

const EXCHANGE_RATE_LIST_VIEW = 515; // Tasa referencial SOLO para la lista general (no afecta el detalle)


import { ModulePage } from '@/components/ui/ModulePage';
import { ModuleToolbar } from '@/components/ui/ModuleToolbar';
import { isValidExchangeRate } from '../utils/financialUtils';
import { triggerFileDownload } from '../utils/fileUtils';

const renderFinancialValue = (value: number | null, currency: 'USD' | 'CRC', isTitle: boolean = false) => {
    if (value === null) {
        return (
            <span className={`text-slate-400 font-bold ${isTitle ? 'text-sm' : 'text-[10px]'}`}>
                —
            </span>
        );
    }
    return formatCurrency(value, currency);
};

interface ProjectAnalysisRow {
    id: number;
    client: string;
    description: string;
    budget: number;
    currency: 'USD' | 'CRC';
    realIncome: number;
    realCosts: number;
    balance: number;
    marginPercent: number;
    isProjectedMargin: boolean; // Flag para indicar si el margen es real o proyectado
    lastMovement: string | null;
    rawQuote: Quote;
}

const ProjectAnalysisModule: React.FC<ProjectAnalysisModuleProps> = ({ currentUser }) => {
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<'CRC' | 'USD' | 'AMBAS'>('USD');
  const [searchTerm, setSearchTerm] = useState('');

  const { entries, loadMore: loadMoreCashflow, hasMore: hasMoreCashflow, isLoadingMore: isLoadingMoreCashflow } = useCashflow(currentUser, filterYear, filterMonth);
  const { quotes, updateQuoteExchangeRate, saveQuote, loadMore: loadMoreQuotes, hasMore: hasMoreQuotes, loading: isLoadingQuotes } = useQuotes(currentUser);
  const { items: inventoryItems } = useInventory(currentUser);
  const { movements: inventoryMovements, loadMore: loadMoreMovements, hasMore: hasMoreMovements, loadingMore: isLoadingMoreMovements } = useInventoryMovements(currentUser);
  const { reports } = useMaterialReports(currentUser);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);

  useEffect(() => {
    const unsubscribe = getTrabajos(setTrabajos);
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const [deleteModal, setDeleteModal] = useState<{ show: boolean, row: any | null, isBlocked?: boolean, blockReason?: string[] }>({ show: false, row: null });
  const [analysisModal, setAnalysisModal] = useState<{ show: boolean, quote: Quote | null }>({ show: false, quote: null });
  const [materialsModal, setMaterialsModal] = useState<{ show: boolean, quote: Quote | null }>({ show: false, quote: null });
  const [restoreModal, setRestoreModal] = useState(false);
  const [rateStatus, setRateStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isDeleting, setIsDeleting] = useState(false);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];


  // Conversión para la LISTA GENERAL (Usa fallback SOLO aquí para poder ordenar/filtrar)
  const convertAmountList = (amount: number, fromCurrency: 'USD' | 'CRC', toCurrency: 'USD' | 'CRC', manualRate?: number) => {
      const rate = manualRate && manualRate > 0 ? manualRate : EXCHANGE_RATE_LIST_VIEW;
      if (fromCurrency === toCurrency) return amount;
      if (fromCurrency === 'USD' && toCurrency === 'CRC') return amount * rate;
      if (fromCurrency === 'CRC' && toCurrency === 'USD') return amount / rate;
      return amount;
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>([new Date().getFullYear().toString()]);
    entries.forEach(e => {
        if (e.date && typeof e.date === 'string') {
            years.add(e.date.split('-')[0]);
        }
    });
    return Array.from(years).sort().reverse();
  }, [entries]);

  const { projectAnalysis, searchWarning } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const isSearchMode = !!term;
    let targetQuotes = quotes;
    let warningMsg = null;

    if (isSearchMode) {
        const cleanId = term.replace('#', '');
        targetQuotes = quotes.filter(q => 
            (q.id?.toString() === cleanId ||
            q.empresa.toLowerCase().includes(term) ||
            (q.codigoCliente && q.codigoCliente.toLowerCase().includes(term))) &&
            !q.analysisHidden
        );

        const exactMatch = quotes.find(q => q.id?.toString() === cleanId);
        if (exactMatch && exactMatch.estado !== 'Aprobada') {
             warningMsg = `La cotización #${exactMatch.id} existe pero no está aprobada. Solo se pueden analizar proyectos aprobados.`;
        }
    } else {
        targetQuotes = quotes.filter(q => q.estado === 'Aprobada' && (filterCurrency === 'AMBAS' || q.moneda === filterCurrency) && !q.analysisHidden);
    }

    const report: ProjectAnalysisRow[] = targetQuotes
        .filter(q => q.estado === 'Aprobada')
        .map(quote => {
            const projectEntries = entries.filter(e => e.projectId === quote.id?.toString());
            
            const relevantEntries = isSearchMode 
                ? projectEntries 
                : projectEntries.filter(e => {
                    if (!e.date || typeof e.date !== 'string') return false;
                    const eYear = e.date.split('-')[0];
                    const eMonth = parseInt(e.date.split('-')[1], 10).toString();
                    if (filterYear !== 'all' && eYear !== filterYear) return false;
                    if (filterMonth !== 'all' && eMonth !== filterMonth) return false;
                    return true;
                });

            const baseCurrency = quote.moneda;
            const effectiveRate = quote.exchangeRate || EXCHANGE_RATE_LIST_VIEW;

            // --- CÁLCULO DE COSTO DE MATERIALES (INVENTARIO) ---
            const projectMovements = (inventoryMovements || []).filter(m => {
                if (m?.projectId !== quote?.id?.toString()) return false;
                if (m?.type !== 'Salida' && m?.type !== 'Devolución') return false;
                
                if (!isSearchMode) {
                    const mYear = m?.date?.split('-')[0] || '';
                    const mMonth = m?.date ? parseInt(m.date.split('-')[1], 10).toString() : '';
                    if (filterYear !== 'all' && mYear !== filterYear) return false;
                    if (filterMonth !== 'all' && mMonth !== filterMonth) return false;
                }
                return true;
            });

            const materialCost = (projectMovements || []).reduce((total, m) => {
                const factor = m?.type === 'Devolución' ? -1 : 1;
                let mCost = 0;
                
                if (m?.items && m.items.length > 0) {
                    (m.items || []).forEach(item => {
                        // PRIORIDAD: Usar precio guardado en el movimiento (Congelado)
                        // FALLBACK: Usar precio actual del catálogo (Solo para datos legacy sin unitPrice)
                        const storedPrice = item?.unitPrice;
                        const storedCurrency = item?.currency;
                        
                        if (storedPrice !== undefined && storedCurrency) {
                            mCost += convertAmountList((item?.quantity || 0) * storedPrice, storedCurrency, baseCurrency, effectiveRate);
                        } else {
                            const invItem = (inventoryItems || []).find(i => i?.id === item?.inventoryItemId);
                            const price = invItem?.price || 0;
                            const currency = invItem?.currency || 'USD';
                            mCost += convertAmountList((item?.quantity || 0) * price, currency, baseCurrency, effectiveRate);
                        }
                    });
                } else {
                    // Caso Legacy (un solo item en la raíz del movimiento)
                    const storedPrice = m?.unitPrice;
                    const storedCurrency = m?.currency;

                    if (storedPrice !== undefined && storedCurrency) {
                        mCost += convertAmountList((m?.quantity || 0) * storedPrice, storedCurrency, baseCurrency, effectiveRate);
                    } else {
                        const invItem = (inventoryItems || []).find(i => i?.id === m?.inventoryItemId);
                        const price = invItem?.price || 0;
                        const currency = invItem?.currency || 'USD';
                        mCost += convertAmountList((m?.quantity || 0) * price, currency, baseCurrency, effectiveRate);
                    }
                }
                
                return total + (mCost * factor);
            }, 0);

            const realIncome = relevantEntries
                .filter(e => e.type === 'Ingreso')
                .reduce((sum, e) => sum + convertAmountList(e.amount, e.currency, baseCurrency, effectiveRate), 0);

            const realCosts = relevantEntries
                .filter(e => e.type === 'Egreso')
                .reduce((sum, e) => sum + convertAmountList(e.amount, e.currency, baseCurrency, effectiveRate), 0) + materialCost;

            const balance = realIncome - realCosts;
            
            // LÓGICA DE MARGEN HÍBRIDO (REAL vs PROYECTADO)
            let marginPercent = 0;
            let isProjectedMargin = false;

            if (realIncome > 0) {
                // Si hay ingresos reales, el margen es real
                marginPercent = ((realIncome - realCosts) / realIncome) * 100;
            } else if (quote.monto > 0) {
                // Si NO hay ingresos, proyectamos sobre el presupuesto
                // Margen Proyectado = (Presupuesto - Costos Reales) / Presupuesto
                isProjectedMargin = true;
                marginPercent = ((quote.monto - realCosts) / quote.monto) * 100;
            }

            return {
                id: quote.id,
                client: quote.empresa,
                description: `Cotización #${(quote.id?.toString() || '').padStart(3, '0')} - ${quote.contacto}`,
                budget: quote.monto,
                currency: baseCurrency,
                realIncome,
                realCosts,
                balance,
                marginPercent,
                isProjectedMargin,
                lastMovement: projectEntries.length > 0 ? projectEntries[0].date : null,
                rawQuote: quote
            };
        });

    return { projectAnalysis: report, searchWarning: warningMsg };

  }, [quotes, entries, inventoryItems, inventoryMovements, filterCurrency, filterYear, filterMonth, searchTerm]);

  const totals = useMemo(() => {
      const crc = { budget: 0, income: 0, costs: 0, balance: 0 };
      const usd = { budget: 0, income: 0, costs: 0, balance: 0 };

      projectAnalysis.forEach(row => {
          const rate = row.rawQuote.exchangeRate || EXCHANGE_RATE_LIST_VIEW;
          
          if (filterCurrency === 'AMBAS') {
              if (row.currency === 'CRC') {
                  crc.budget += row.budget;
                  crc.income += row.realIncome;
                  crc.costs += row.realCosts;
                  crc.balance += row.balance;
              } else {
                  usd.budget += row.budget;
                  usd.income += row.realIncome;
                  usd.costs += row.realCosts;
                  usd.balance += row.balance;
              }
          } else {
              const budget = convertAmountList(row.budget, row.currency, filterCurrency, rate);
              const income = convertAmountList(row.realIncome, row.currency, filterCurrency, rate);
              const costs = convertAmountList(row.realCosts, row.currency, filterCurrency, rate);
              const balance = convertAmountList(row.balance, row.currency, filterCurrency, rate);
              
              if (filterCurrency === 'CRC') {
                  crc.budget += budget;
                  crc.income += income;
                  crc.costs += costs;
                  crc.balance += balance;
              } else {
                  usd.budget += budget;
                  usd.income += income;
                  usd.costs += costs;
                  usd.balance += balance;
              }
          }
      });

      return { crc, usd };
  }, [projectAnalysis, filterCurrency]);

  // --- LÓGICA DE CÁLCULO REACTIVO Y ESTRICTO PARA EL MODAL DETALLADO ---
  
  // Convertidor estricto: Retorna null si no hay T.C. y las monedas difieren
  const convertAmountAnalysisStrict = (amount: number, from: 'USD' | 'CRC', to: 'USD' | 'CRC', rate: number | undefined | null): number | null => {
      if (from === to) return amount;
      if (!isValidExchangeRate(rate)) return null; // BLOQUEO DE SEGURIDAD
      
      if (from === 'USD' && to === 'CRC') return amount * rate!;
      if (from === 'CRC' && to === 'USD') return amount / rate!;
      return null;
  };

  const getAnalysisDetails = (quote: Quote) => {
      if (!quote) return null;

      const projectEntries = entries.filter(e => e.projectId === quote.id?.toString());
      
      // Obtenemos T.C. sin fallback. Si es null/0/undefined, es inválido.
      const currentRate = quote.exchangeRate;
      
      // Definir monedas
      const primaryRaw = quote.moneda;
      const primary: 'USD' | 'CRC' = (primaryRaw === 'CRC' || primaryRaw === 'USD') ? primaryRaw : 'USD';
      const secondary: 'USD' | 'CRC' = primary === 'USD' ? 'CRC' : 'USD';

      // 1. Presupuesto
      const budgetPrimary = quote.monto;
      const budgetSecondary = convertAmountAnalysisStrict(quote.monto, primary, secondary, currentRate);

      // 2. Ingresos Reales
      const incomeEntries = projectEntries.filter(e => e.type === 'Ingreso');
      
      // Suma separada por moneda origen para detectar bloqueos
      const incomeInPrimary = incomeEntries.filter(e => e.currency === primary).reduce((s, e) => s + e.amount, 0);
      const incomeInSecondary = incomeEntries.filter(e => e.currency === secondary).reduce((s, e) => s + e.amount, 0);

      // Totales calculados (pueden ser null si falta tasa y hay montos en la otra moneda)
      let incomePrimaryTotal: number | null = incomeInPrimary;
      if (incomeInSecondary > 0) {
          const converted = convertAmountAnalysisStrict(incomeInSecondary, secondary, primary, currentRate);
          if (converted === null) incomePrimaryTotal = null; // Tainted
          else incomePrimaryTotal += converted;
      }

      let incomeSecondaryTotal: number | null = incomeInSecondary;
      if (incomeInPrimary > 0) {
          const converted = convertAmountAnalysisStrict(incomeInPrimary, primary, secondary, currentRate);
          if (converted === null) incomeSecondaryTotal = null; // Tainted
          else incomeSecondaryTotal += converted;
      }

      // 3. Costos Reales
      const costEntries = projectEntries.filter(e => e.type === 'Egreso');
      const costInPrimary = costEntries.filter(e => e.currency === primary).reduce((s, e) => s + e.amount, 0);
      const costInSecondary = costEntries.filter(e => e.currency === secondary).reduce((s, e) => s + e.amount, 0);

      let costPrimaryTotal: number | null = costInPrimary;
      if (costInSecondary > 0) {
          const converted = convertAmountAnalysisStrict(costInSecondary, secondary, primary, currentRate);
          if (converted === null) costPrimaryTotal = null;
          else costPrimaryTotal += converted;
      }

      let costSecondaryTotal: number | null = costInSecondary;
      if (costInPrimary > 0) {
          const converted = convertAmountAnalysisStrict(costInPrimary, primary, secondary, currentRate);
          if (converted === null) costSecondaryTotal = null;
          else costSecondaryTotal += converted;
      }

      // 9. Integrar Costo de Materiales (Consumo desde Inventario)
      const projectInvMovements = inventoryMovements.filter(m => 
          m.projectId === quote.id?.toString() && (m.type === 'Salida' || m.type === 'Devolución')
      );
      let materialCostPrimary = 0;
      let materialCostSecondary = 0;
      let materialQuantity = 0;

      projectInvMovements.forEach(m => {
          const factor = m.type === 'Devolución' ? -1 : 1;
          
          const processItem = (itemId: string, qty: number, historicalPrice?: number, historicalCurrency?: 'USD' | 'CRC') => {
              const invItem = inventoryItems.find(i => i.id === itemId);
              const price = historicalPrice !== undefined ? historicalPrice : (invItem?.price || 0);
              const currency = historicalCurrency || (invItem?.currency || 'USD');
              
              const cost = qty * price * factor;
              
              const valPrimary = convertAmountAnalysisStrict(cost, currency, primary, currentRate);
              const valSecondary = convertAmountAnalysisStrict(cost, currency, secondary, currentRate);

              if (valPrimary !== null) materialCostPrimary += valPrimary;
              if (valSecondary !== null) materialCostSecondary += valSecondary;
              
              materialQuantity += (qty * factor);
          };

          if (m.items && m.items.length > 0) {
              m.items.forEach(item => processItem(item.inventoryItemId, item.quantity, item.unitPrice, item.currency));
          } else {
              processItem(m.inventoryItemId, m.quantity, m.unitPrice, m.currency);
          }
      });
      
      // Actualizar costos totales con materiales antes de calcular utilidad
      if (costPrimaryTotal !== null) costPrimaryTotal += materialCostPrimary;
      if (costSecondaryTotal !== null) costSecondaryTotal += materialCostSecondary;

      // 4. Utilidad Real
      let utilityPrimary: number | null = null;
      if (incomePrimaryTotal !== null && costPrimaryTotal !== null) {
          utilityPrimary = incomePrimaryTotal - costPrimaryTotal;
      }

      let utilitySecondary: number | null = null;
      if (incomeSecondaryTotal !== null && costSecondaryTotal !== null) {
          utilitySecondary = incomeSecondaryTotal - costSecondaryTotal;
      }
      
      // 5. Utilidad Proyectada (Forecast)
      // Presupuesto - Costos Reales
      let projectedPrimary: number | null = null;
      if (costPrimaryTotal !== null) {
          projectedPrimary = budgetPrimary - costPrimaryTotal;
      }

      let projectedSecondary: number | null = null;
      if (budgetSecondary !== null && costSecondaryTotal !== null) {
          projectedSecondary = budgetSecondary - costSecondaryTotal;
      }

      // 6. Margen Real
      let profitMargin = 0;
      if (incomePrimaryTotal !== null && costPrimaryTotal !== null && incomePrimaryTotal > 0) {
          profitMargin = ((incomePrimaryTotal - costPrimaryTotal) / incomePrimaryTotal) * 100;
      }

      // 7. Margen Proyectado (Nuevo cálculo para Card)
      // (Proyección / Presupuesto) * 100
      let projectedMarginPercent = 0;
      if (projectedPrimary !== null && budgetPrimary > 0) {
          projectedMarginPercent = (projectedPrimary / budgetPrimary) * 100;
      }

      // 8. Desglose de Costos (con soporte null)
      const breakdown = costEntries.reduce((acc, curr) => {
          const cat = curr.subtype || 'Otro Egreso';
          if (!acc[cat]) acc[cat] = { primary: 0, secondary: 0, items: 0, isPartial: false };
          
          const valPrimary = convertAmountAnalysisStrict(curr.amount, curr.currency, primary, currentRate);
          const valSecondary = convertAmountAnalysisStrict(curr.amount, curr.currency, secondary, currentRate);

          if (valPrimary === null) acc[cat].isPartial = true;
          else acc[cat].primary += valPrimary;

          if (valSecondary === null) acc[cat].isPartial = true;
          else acc[cat].secondary += valSecondary;

          acc[cat].items += 1;
          
          return acc;
      }, {} as Record<string, { primary: number, secondary: number, items: number, isPartial: boolean }>);
      
      return {
          primaryCurrency: primary,
          secondaryCurrency: secondary,
          hasValidRate: isValidExchangeRate(currentRate),
          budget: { primary: budgetPrimary, secondary: budgetSecondary },
          income: { primary: incomePrimaryTotal, secondary: incomeSecondaryTotal },
          costs: { primary: costPrimaryTotal, secondary: costSecondaryTotal },
          utility: { primary: utilityPrimary, secondary: utilitySecondary },
          projection: { primary: projectedPrimary, secondary: projectedSecondary },
          overall: { margin: profitMargin, projectedMargin: projectedMarginPercent },
          breakdown,
          entries: projectEntries,
          materialCostPrimary,
          materialCostSecondary,
          materialQuantity
      };
  };

  const handleLocalRateChange = (val: string) => {
      if (!analysisModal.quote) return;
      
      // Limpiar si es 0, negativo o vacío
      const num = parseFloat(val);
      const cleanVal = isNaN(num) || num <= 0 ? undefined : num;
      
      setRateStatus('idle');
      
      setAnalysisModal(prev => {
          if (!prev.quote) return prev;
          return {
              ...prev,
              quote: { 
                  ...prev.quote, 
                  exchangeRate: cleanVal
              }
          };
      });
  };

  const handlePersistRate = async () => {
      if (!analysisModal.quote) return;
      const newRate = analysisModal.quote.exchangeRate || 0;
      try {
          // Si newRate es 0 o undefined, se guarda como null en la BD para consistencia
          const rateToSave = newRate > 0 ? newRate : null;

          if (analysisModal.quote.docId) {
              await updateQuoteExchangeRate(analysisModal.quote.docId, rateToSave);
          } else {
              await updateQuoteExchangeRate(analysisModal.quote.id, analysisModal.quote.fecha, rateToSave);
          }
          setRateStatus('success');
          setTimeout(() => setRateStatus('idle'), 3000);
      } catch (error) {
          console.error("Error updating rate:", error);
          setRateStatus('error');
          setTimeout(() => setRateStatus('idle'), 3000);
      }
  };

  const handleExportExcel = () => {
    const dataToExport = projectAnalysis.map(row => ({
        "ID": row.id,
        "Cliente": row.client,
        "Descripción": row.description,
        "Moneda": row.currency,
        "Presupuesto": row.budget,
        "Ingresos Reales": row.realIncome,
        "Costos Reales": row.realCosts,
        "Balance": row.balance,
        "Margen %": parseFloat(row.marginPercent.toFixed(2)),
        "Tipo Margen": row.isProjectedMargin ? 'Proyectado' : 'Real'
    }));
    exportToExcel(dataToExport, `Analisis_Proyectos_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  };

  const handleExportPDF = async () => {
    // Formateador especial solo para tabla (sin símbolos)
    const formatNumberOnly = (amount: number) => {
        return new Intl.NumberFormat('es-CR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    // 1. Preparar Datos de Tabla para el Layout (Mapeo a 6 columnas usando la tabla principal)
    // Se eliminan los símbolos de moneda de los valores numéricos
    const tableData = projectAnalysis.map(row => [
        `${row.client}\n#${(row.id?.toString() || '').padStart(3, '0')}`,
        formatNumberOnly(row.budget),
        formatNumberOnly(row.realIncome),
        formatNumberOnly(row.realCosts),
        formatNumberOnly(row.balance),
        `${row.marginPercent.toFixed(1)}% ${row.isProjectedMargin ? '(P)' : ''}`
    ]);

    // 2. Calcular Margen Global para KPIs
    const totalMargin = filterCurrency === 'AMBAS' 
        ? ((totals.usd.income + totals.crc.income) > 0 ? (((totals.usd.income + totals.crc.income) - (totals.usd.costs + totals.crc.costs)) / (totals.usd.income + totals.crc.income)) * 100 : 0)
        : (totals.income > 0 ? ((totals.income - totals.costs) / totals.income) * 100 : 0);

    // 3. Construir String de Filtros (Año / Mes)
    const yearStr = filterYear === 'all' ? 'Todos' : filterYear;
    const monthStr = filterMonth === 'all' ? 'Todos' : monthNames[parseInt(filterMonth) - 1];
    // Texto descriptivo para el encabezado del PDF
    const filtersDescription = `Año: ${yearStr} | Mes: ${monthStr} | Moneda: ${filterCurrency}`;

    // 4. Construir Objeto de Datos para el Motor de Renderizado
    const reportData: DetailedFinancialReportData = {
        header: {
            projectName: "ANÁLISIS DE PROYECTOS",
            clientName: "Reporte General",
            currency: filterCurrency === 'AMBAS' ? 'USD/CRC' : filterCurrency,
            refId: `REP-${new Date().toISOString().split('T')[0]}`,
            date: new Date().toLocaleDateString('es-CR'),
            exchangeRate: 0, // Ignorado por hideExchangeRate: true
            period: filtersDescription, // Se envía la descripción de filtros
            userName: currentUser.email.split('@')[0].toUpperCase(),
            projectCount: projectAnalysis.length.toString()
        },
        kpis: {
            budget: filterCurrency === 'AMBAS' ? `USD ${formatNumberOnly(totals.usd.budget)} / CRC ${formatNumberOnly(totals.crc.budget)}` : formatCurrency(totals.budget, filterCurrency),
            costs: filterCurrency === 'AMBAS' ? `USD ${formatNumberOnly(totals.usd.costs)} / CRC ${formatNumberOnly(totals.crc.costs)}` : formatCurrency(totals.costs, filterCurrency),
            utility: filterCurrency === 'AMBAS' ? `USD ${formatNumberOnly(totals.usd.balance)} / CRC ${formatNumberOnly(totals.crc.balance)}` : formatCurrency(totals.balance, filterCurrency),
            margin: `${totalMargin.toFixed(1)}%`,
            marginValue: totalMargin
        },
        tables: {
            breakdown: tableData, // Datos de Proyectos
            history: [] // Ignorado por config
        },
        totals: {
            budget: filterCurrency === 'AMBAS' ? `USD ${formatNumberOnly(totals.usd.budget)} / CRC ${formatNumberOnly(totals.crc.budget)}` : formatCurrency(totals.budget, filterCurrency),
            costs: filterCurrency === 'AMBAS' ? `USD ${formatNumberOnly(totals.usd.costs)} / CRC ${formatNumberOnly(totals.crc.costs)}` : formatCurrency(totals.costs, filterCurrency),
            utility: filterCurrency === 'AMBAS' ? `USD ${formatNumberOnly(totals.usd.balance)} / CRC ${formatNumberOnly(totals.crc.balance)}` : formatCurrency(totals.balance, filterCurrency),
            crc: filterCurrency === 'CRC' || filterCurrency === 'AMBAS' ? formatCurrency(totals.crc?.balance || totals.balance, 'CRC') : '---',
            usd: filterCurrency === 'USD' || filterCurrency === 'AMBAS' ? formatCurrency(totals.usd?.balance || totals.balance, 'USD') : '---'
        },
        // Configuración para adaptar el layout base
        config: {
            mainTitle: "ANÁLISIS FINANCIERO POR PROYECTO",
            subTitle: "Rentabilidad basada en cotizaciones aprobadas y flujo de caja",
            hideExchangeRate: true, // OCULTAR T.C. Y MOSTRAR FILTROS
            table1: {
                title: "RESUMEN DE PROYECTOS",
                headers: ["PROYECTO / CLIENTE", "PRESUPUESTO", "INGRESOS", "COSTOS", "UTILIDAD", "MARGEN"],
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold', cellWidth: 'auto' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' },
                    5: { halign: 'center' }
                }
            },
            table2: {
                hidden: true // Ocultar tabla de historial
            }
        }
    };

    // 5. Renderizar usando el Layout Base
    const doc = new jsPDF();
    await renderDetailedFinancialLayout(doc, reportData);
    const fileName = `Estatus_Cotizacion_${reportData.metadata.quoteNumber}.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, fileName);
  };

  const handleDeleteRequest = useCallback((row: any) => {
      const qIdStr = row.id?.toString();
      const reasons: string[] = [];

      if (row.realIncome > 0) reasons.push("Ingresos reales registrados");
      if (row.realCosts > 0) reasons.push("Costos reales registrados");

      // Check Jobs
      const linkedJobs = (trabajos || []).filter(job => (job as any).projectId === qIdStr || (job as any).quoteId === qIdStr);
      if (linkedJobs.length > 0) reasons.push(`${linkedJobs.length} Trabajos programados`);

      // Check Reports
      const linkedReports = (reports || []).filter(rep => rep && rep.project && rep.project.id === qIdStr);
      if (linkedReports.length > 0) reasons.push(`${linkedReports.length} Reportes de materiales`);

      if (reasons.length > 0) {
          setDeleteModal({ 
              show: true, 
              row, 
              isBlocked: true, 
              blockReason: reasons 
          });
          return;
      }
      setDeleteModal({ show: true, row, isBlocked: false });
  }, [trabajos, reports]);

  const confirmDelete = async () => {
      if (!deleteModal.row) return;
      setIsDeleting(true);
      try {
          // Soft Delete: Ocultar análisis sin cambiar estado de cotización
          await saveQuote({ 
              ...deleteModal.row.rawQuote, 
              analysisHidden: true 
          }, deleteModal.row.rawQuote.id, deleteModal.row.rawQuote.fecha);

          setDeleteModal({ show: false, row: null });
      } catch (error: any) {
          console.error("Error deleting analysis:", error);
      } finally {
          setIsDeleting(false);
      }
  };

  const handleRestore = async (quote: Quote) => {
      try {
          await saveQuote({ 
              ...quote, 
              analysisHidden: false 
          }, quote.id, quote.fecha);
          setRestoreModal(false);
      } catch (error: any) {
          console.error("Error restoring analysis:", error);
      }
  };

  const handleViewAnalysis = useCallback((quote: Quote) => {
      setAnalysisModal({ show: true, quote });
  }, []);

  const projectAnalysisKeyExtractor = useCallback((s: ProjectAnalysisRow) => s.id?.toString() || '', []);

  const handleExportDetailExcel = (quote: Quote, entries: CashflowEntry[]) => {
      const projectEntries = entries.filter(e => e.projectId === quote.id?.toString());
      
      // Obtener movimientos de inventario para el excel
      const projectMovements = inventoryMovements.filter(m => 
          m.projectId === quote.id?.toString() && (m.type === 'Salida' || m.type === 'Devolución')
      );

      const cashflowData = projectEntries.map(e => ({
          Fecha: e.date,
          Tipo: e.type,
          Categoría: e.subtype || 'N/A',
          Descripción: e.description,
          Moneda: e.currency,
          Monto: e.amount
      }));

      const inventoryData = projectMovements.flatMap(m => {
          const factor = m.type === 'Devolución' ? -1 : 1;
          const process = (itemId: string, qty: number) => {
              const item = inventoryItems.find(i => i.id === itemId);
              return {
                  Fecha: m.date,
                  Tipo: 'Egreso (Material)',
                  Categoría: 'Materiales Consumidos',
                  Descripción: item?.description || 'Material Desconocido',
                  Moneda: item?.currency || 'USD',
                  Monto: (qty * (item?.price || 0) * factor)
              };
          };
          if (m.items && m.items.length > 0) {
              return m.items.map(i => process(i.inventoryItemId, i.quantity));
          } else {
              return [process(m.inventoryItemId, m.quantity)];
          }
      });

      const data = [...cashflowData, ...inventoryData].sort((a, b) => new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime());
      
      exportToExcel(data, `Detalle_Proyecto_${quote.id}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportDetailPDF = async (quote: Quote, entries: CashflowEntry[]) => {
      const doc = new jsPDF();
      
      // OJO: En exportación usamos el fallback si es necesario, o se puede usar lógica estricta.
      // Por consistencia con la vista general, usamos el fallback aquí para que el PDF no falle.
      const rate = quote.exchangeRate || EXCHANGE_RATE_LIST_VIEW;
      
      // 1. Preparar Datos KPI
      const projectEntries = entries.filter(e => e.projectId === quote.id?.toString());
      
      // --- CÁLCULO DE COSTO DE MATERIALES (INVENTARIO) ---
      const projectMovements = inventoryMovements.filter(m => 
          m.projectId === quote.id?.toString() && (m.type === 'Salida' || m.type === 'Devolución')
      );
      
      let materialCostConverted = 0;
      projectMovements.forEach(m => {
          const factor = m.type === 'Devolución' ? -1 : 1;
          const processItem = (itemId: string, qty: number, hPrice?: number, hCurrency?: 'USD' | 'CRC') => {
              const invItem = inventoryItems.find(i => i.id === itemId);
              const price = hPrice !== undefined ? hPrice : (invItem?.price || 0);
              const currency = hCurrency || (invItem?.currency || 'USD');
              const cost = qty * price * factor;
              
              if (currency === quote.moneda) materialCostConverted += cost;
              else if (quote.moneda === 'USD' && currency === 'CRC') materialCostConverted += (cost / rate);
              else if (quote.moneda === 'CRC' && currency === 'USD') materialCostConverted += (cost * rate);
          };
          if (m.items && m.items.length > 0) {
              m.items.forEach(item => processItem(item.inventoryItemId, item.quantity, item.unitPrice, item.currency));
          } else {
              processItem(m.inventoryItemId, m.quantity, m.unitPrice, m.currency);
          }
      });

      const costsConverted = projectEntries
          .filter(e => e.type === 'Egreso')
          .reduce((sum, e) => {
              if (e.currency === quote.moneda) return sum + e.amount;
              if (quote.moneda === 'USD' && e.currency === 'CRC') return sum + (e.amount / rate);
              if (quote.moneda === 'CRC' && e.currency === 'USD') return sum + (e.amount * rate);
              return sum;
          }, 0) + materialCostConverted;

      const incomeConverted = projectEntries
          .filter(e => e.type === 'Ingreso')
          .reduce((sum, e) => {
              if (e.currency === quote.moneda) return sum + e.amount;
              if (quote.moneda === 'USD' && e.currency === 'CRC') return sum + (e.amount / rate);
              if (quote.moneda === 'CRC' && e.currency === 'USD') return sum + (e.amount * rate);
              return sum;
          }, 0);

      const utility = incomeConverted - costsConverted;
      const profitMargin = incomeConverted > 0 ? (utility / incomeConverted) * 100 : 0;

      // FORMATTER FOR KPIS: $ 7 650,94
      const formatKPI = (val: number, currency: string) => {
          const symbol = currency === 'USD' ? '$' : '¢';
          const parts = val.toFixed(2).split('.');
          // Add space as thousands separator
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
          return `${symbol} ${parts[0]},${parts[1]}`;
      };

      // 2. Preparar Desglose de Costos
      const costBreakdown: Record<string, { USD: number, CRC: number, items: number }> = {};
      
      projectEntries.filter(e => e.type === 'Egreso').forEach(e => {
          const cat = e.subtype || 'Otro Egreso';
          if (!costBreakdown[cat]) costBreakdown[cat] = { USD: 0, CRC: 0, items: 0 };
          costBreakdown[cat][e.currency] += e.amount;
          costBreakdown[cat].items += 1;
      });

      const formatTableMoney = (val: number, currency: string) => {
          const symbol = currency === 'USD' ? '$' : '¢';
          return `${symbol} ${val.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      const breakdownData = Object.entries(costBreakdown).map(([category, vals]) => [
          category.toUpperCase(),
          vals.items.toString(),
          formatTableMoney(vals.USD, 'USD'),
          formatTableMoney(vals.CRC, 'CRC')
      ]);

      // Agregar Materiales al desglose del PDF
      const matUSD = projectMovements.reduce((acc, m) => {
          const factor = m.type === 'Devolución' ? -1 : 1;
          let sum = 0;
          const process = (id: string, q: number) => {
              const item = inventoryItems.find(i => i.id === id);
              if (item?.currency === 'USD') sum += (q * item.price * factor);
          };
          if (m.items) m.items.forEach(i => process(i.inventoryItemId, i.quantity));
          else process(m.inventoryItemId, m.quantity);
          return acc + sum;
      }, 0);

      const matCRC = projectMovements.reduce((acc, m) => {
          const factor = m.type === 'Devolución' ? -1 : 1;
          let sum = 0;
          const process = (id: string, q: number) => {
              const item = inventoryItems.find(i => i.id === id);
              if (item?.currency === 'CRC') sum += (q * item.price * factor);
          };
          if (m.items) m.items.forEach(i => process(i.inventoryItemId, i.quantity));
          else process(m.inventoryItemId, m.quantity);
          return acc + sum;
      }, 0);

      if (matUSD !== 0 || matCRC !== 0) {
          breakdownData.push([
              'MATERIALES CONSUMIDOS',
              projectMovements.length.toString(),
              formatTableMoney(matUSD, 'USD'),
              formatTableMoney(matCRC, 'CRC')
          ]);
      }

      // 3. Preparar Historial
      const historyData = projectEntries.map(e => [
          e.date,
          e.description.substring(0, 50).toUpperCase(),
          (e.subtype || e.type).toUpperCase(),
          e.currency,
          e.amount.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
      ]);

      // 4. Preparar Totales Footer
      const totalColones = projectEntries.filter(e => e.currency === 'CRC').reduce((acc, e) => acc + e.amount, 0);
      const totalDollars = projectEntries.filter(e => e.currency === 'USD').reduce((acc, e) => acc + e.amount, 0);

      // 5. Construir Objeto de Datos para el Renderer
      const reportData: DetailedFinancialReportData = {
        header: {
          projectName: quote.empresa,
          projectCode: `#${(quote.id?.toString() || '').padStart(3, '0')}-${getYearFromDateString(quote.fecha)}`,
          clientName: quote.contacto,
          currency: quote.moneda,
          refId: `#${(quote.id?.toString() || '').padStart(3, '0')}-${getYearFromDateString(quote.fecha)}`,
          date: new Date().toLocaleDateString('es-CR'),
          exchangeRate: rate,
          period: "GENERAL", // Opcional
          userName: currentUser.email.split('@')[0].toUpperCase(),
          projectCount: "N/A"
        },
        kpis: {
          budget: formatKPI(quote.monto, quote.moneda),
          costs: formatKPI(costsConverted, quote.moneda),
          utility: formatKPI(utility, quote.moneda),
          margin: `${profitMargin.toFixed(1)}%`,
          marginValue: profitMargin
        },
        tables: {
          breakdown: breakdownData,
          history: historyData
        },
        totals: {
          crc: totalColones.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          usd: totalDollars.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }
      };

      // 6. Ejecutar Renderer
      await renderDetailedFinancialLayout(doc, reportData);

      // 7. Guardar
      const fileName = `Estatus_${reportData.metadata.client.replace(/[\s-]+/g, '_')}_${reportData.metadata.quoteNumber}.pdf`;
      const blob = doc.output('blob');
      triggerFileDownload(blob, fileName);
  };

  // Definición de columnas para DataTable
  const columns = useMemo<TableColumn<ProjectAnalysisRow>[]>(() => [
    {
        header: 'Proyecto / Cliente',
        render: (row) => (
            <div className="flex flex-col">
                <span className="font-black text-blue-900 text-xs mb-0.5">{row.client}</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 rounded">#{(row.id?.toString() || '').padStart(3, '0')}</span>
                    <span className="text-[10px] font-bold text-slate-400">{row.currency}</span>
                </div>
            </div>
        )
    },
    {
        header: 'Presupuesto',
        align: 'right',
        render: (row) => <span className="font-mono text-slate-500 font-bold">{formatCurrency(row.budget, row.currency)}</span>
    },
    {
        header: 'Ingresos Reales',
        align: 'right',
        className: 'bg-emerald-50/10',
        render: (row) => <span className="font-mono text-emerald-600 font-black">{formatCurrency(row.realIncome, row.currency)}</span>
    },
    {
        header: 'Costos Reales',
        align: 'right',
        className: 'bg-red-50/10',
        render: (row) => <span className="font-mono text-red-500 font-bold">{formatCurrency(row.realCosts, row.currency)}</span>
    },
    {
        header: 'Utilidad',
        align: 'right',
        className: 'bg-blue-50/10',
        render: (row) => <span className={`font-mono font-black ${row.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(row.balance, row.currency)}</span>
    },
    {
        header: 'Margen',
        align: 'center',
        render: (row) => {
            const isProjected = row.isProjectedMargin;
            let bgColor = 'bg-slate-100';
            let textColor = 'text-slate-700';
            let borderColor = 'border-slate-200';

            if (isProjected) {
                // Estilo para margen proyectado (Neutro/Azul)
                bgColor = 'bg-blue-50';
                textColor = 'text-blue-600';
                borderColor = 'border-blue-100';
            } else {
                // Estilo para margen real (Semáforo habitual)
                if (row.marginPercent >= 20) {
                    bgColor = 'bg-green-100';
                    textColor = 'text-green-700';
                    borderColor = 'border-green-200';
                } else if (row.marginPercent > 0) {
                    bgColor = 'bg-amber-100';
                    textColor = 'text-amber-700';
                    borderColor = 'border-amber-200';
                } else {
                    bgColor = 'bg-red-100';
                    textColor = 'text-red-700';
                    borderColor = 'border-red-200';
                }
            }

            return (
                <span className={`px-2 py-1 rounded-full text-[9px] font-black border ${bgColor} ${textColor} ${borderColor}`}>
                    {row.marginPercent.toFixed(1)}% {isProjected && '(P)'}
                </span>
            );
        }
    },
    {
        header: 'Acciones',
        align: 'center',
        render: (row) => (
            <ActionButtons 
                onView={() => handleViewAnalysis(row.rawQuote)}
                onDelete={() => handleDeleteRequest(row)}
                viewTitle="Ver Análisis Detallado"
                deleteTitle="Eliminar Análisis"
            />
        )
    }
  ], [handleViewAnalysis, handleDeleteRequest]);

  const isDataReady = !!(currentUser && currentUser.email && quotes && entries && inventoryItems && inventoryMovements);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
    <ModulePage title="Análisis Financiero por Proyecto" subtitle="Rentabilidad basada en cotizaciones aprobadas y flujo de caja.">
      {!isDataReady ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
          <FiLoader className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Cargando datos...</p>
        </div>
      ) : (
        <>
          <ModuleToolbar>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                <div>
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Solo Lectura</span>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl">
                   <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => setFilterCurrency('CRC')} 
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${filterCurrency === 'CRC' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                       Colones (CRC)
                   </div>
                   <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => setFilterCurrency('USD')} 
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${filterCurrency === 'USD' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                       Dólares (USD)
                   </div>
                   <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => setFilterCurrency('AMBAS')} 
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${filterCurrency === 'AMBAS' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                       Ambas Monedas
                   </div>
                </div>
            </div>
          </ModuleToolbar>
          <div className="px-6 pb-3 pt-2">

        {searchWarning && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-none text-amber-600">
                    <FiAlertTriangle  />
                </div>
                <div>
                    <h4 className="text-sm font-black text-amber-800">Atención</h4>
                    <p className="text-xs font-bold text-amber-700">{searchWarning}</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 md:p-4">
                <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Presupuesto Total</p>
                {filterCurrency === 'AMBAS' ? (
                    <div className="flex flex-col mt-1">
                        <span className="text-sm font-black text-slate-700">{formatCurrency(totals.usd.budget, 'USD')}</span>
                        <span className="text-sm font-black text-slate-700">{formatCurrency(totals.crc.budget, 'CRC')}</span>
                    </div>
                ) : (
                    <p className="text-sm md:text-xl font-black text-slate-700 mt-1">{formatCurrency(filterCurrency === 'USD' ? totals.usd.budget : totals.crc.budget, filterCurrency)}</p>
                )}
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 md:p-4">
                <p className="text-[9px] md:text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Ingresos Reales</p>
                {filterCurrency === 'AMBAS' ? (
                    <div className="flex flex-col mt-1">
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(totals.usd.income, 'USD')}</span>
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(totals.crc.income, 'CRC')}</span>
                    </div>
                ) : (
                    <p className="text-sm md:text-xl font-black text-emerald-600 mt-1">{formatCurrency(filterCurrency === 'USD' ? totals.usd.income : totals.crc.income, filterCurrency)}</p>
                )}
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 md:p-4">
                <p className="text-[9px] md:text-[10px] font-bold text-red-800 uppercase tracking-widest">Costos Reales</p>
                {filterCurrency === 'AMBAS' ? (
                    <div className="flex flex-col mt-1">
                        <span className="text-sm font-black text-red-600">{formatCurrency(totals.usd.costs, 'USD')}</span>
                        <span className="text-sm font-black text-red-600">{formatCurrency(totals.crc.costs, 'CRC')}</span>
                    </div>
                ) : (
                    <p className="text-sm md:text-xl font-black text-red-600 mt-1">{formatCurrency(filterCurrency === 'USD' ? totals.usd.costs : totals.crc.costs, filterCurrency)}</p>
                )}
            </div>
            <div className={`border rounded-2xl p-3 md:p-4 ${filterCurrency !== 'AMBAS' && (filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${filterCurrency !== 'AMBAS' && (filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance) >= 0 ? 'text-blue-800' : 'text-slate-800'}`}>Balance Neto</p>
                {filterCurrency === 'AMBAS' ? (
                    <div className="flex flex-col mt-1">
                        <span className={`text-sm font-black ${totals.usd.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(totals.usd.balance, 'USD')}</span>
                        <span className={`text-sm font-black ${totals.crc.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(totals.crc.balance, 'CRC')}</span>
                    </div>
                ) : (
                    <p className={`text-sm md:text-xl font-black mt-1 ${(filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance) >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                        {formatCurrency(filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance, filterCurrency)}
                    </p>
                )}
            </div>
        </div>

        <Toolbar
            left={
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto items-center">
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)} disabled={!!searchTerm} className="w-full sm:w-auto flex-1 md:flex-none px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                        <option value="all">Todos los Años</option>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} disabled={!!searchTerm} className="w-full sm:w-auto flex-1 md:flex-none px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                        <option value="all">Todos los Meses</option>
                        {monthNames.map((m, i) => <option key={m} value={(i+1).toString()}>{m}</option>)}
                    </select>
                    <ActionButton 
                        onClick={() => setRestoreModal(true)}
                        variant="primary"
                        icon={<FiPlus />}
                        label="Nuevo Análisis"
                    />
                    {searchTerm && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 animate-in fade-in">
                            <FiInfo className="mr-1"  /> Filtros de fecha desactivados durante búsqueda
                        </span>
                    )}
                </div>
            }
            right={
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
                    <div className="relative flex-1 w-full sm:w-auto md:w-64 max-w-full">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"  />
                        <input 
                            type="text" 
                            placeholder="Buscar por # Cotización, Proyecto o Cliente..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-100 transition-all text-ellipsis overflow-hidden whitespace-nowrap"
                        />
                        {searchTerm && (
                            <div 
                                role="button"
                                tabIndex={0}
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <FiX className="text-xs"  />
                            </div>
                        )}
                    </div>
                    <div className="flex gap-1 w-full sm:w-auto">
                        <IconButton icon={<ACTION_ICONS.excel />} variant="success" onClick={handleExportExcel} title="Exportar Excel" />
                        <IconButton icon={<ACTION_ICONS.pdf />} variant="danger" onClick={handleExportPDF} title="Exportar PDF" />
                    </div>
                </div>
            }
        />

        {/* Tabla Listado */}
        <div className="mt-3">
            <DataTable<ProjectAnalysisRow> 
                data={projectAnalysis}
                columns={columns}
                keyExtractor={projectAnalysisKeyExtractor}
                isLoading={isLoadingQuotes}
                hasMore={hasMoreQuotes}
                onLoadMore={loadMoreQuotes}
                isLoadingMore={isLoadingQuotes}
                enableVirtualization={true}
                virtualHeight="600px"
                emptyMessage={searchTerm 
                    ? "No se encontraron proyectos aprobados con ese criterio." 
                    : `No hay proyectos aprobados en ${filterCurrency} para el periodo seleccionado.`}
            />
            
            {(hasMoreCashflow || hasMoreMovements) && (
                <div className="mt-2 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
                    <FiAlertTriangle className="text-amber-500 shrink-0" />
                    <div className="flex-1">
                        <p className="text-[11px] text-amber-800 font-bold">Hay más datos históricos disponibles que no se han cargado.</p>
                        <p className="text-[10px] text-amber-600">Para un análisis completo de proyectos antiguos, asegúrese de cargar todos los movimientos.</p>
                    </div>
                    <div className="flex gap-2">
                        {hasMoreCashflow && (
                            <div 
                                role="button"
                                tabIndex={0}
                                onClick={isLoadingMoreCashflow ? undefined : loadMoreCashflow} 
                                className={`px-3 py-1.5 bg-white border border-amber-200 text-amber-700 text-[10px] font-black rounded-lg cursor-pointer hover:bg-amber-50 ${isLoadingMoreCashflow ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                {isLoadingMoreCashflow ? 'Cargando...' : 'Cargar más Finanzas'}
                            </div>
                        )}
                        {hasMoreMovements && (
                            <div 
                                role="button"
                                tabIndex={0}
                                onClick={isLoadingMoreMovements ? undefined : loadMoreMovements} 
                                className={`px-3 py-1.5 bg-white border border-amber-200 text-amber-700 text-[10px] font-black rounded-lg cursor-pointer hover:bg-amber-50 ${isLoadingMoreMovements ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                {isLoadingMoreMovements ? 'Cargando...' : 'Cargar más Inventario'}
                            </div>
                        )}
                    </div>
                </div>
            )}
            </div>
          </div>
          </>
        )}
      </ModulePage>

      {analysisModal.show && analysisModal.quote && createPortal(
        <div className="fixed inset-0 z-[9000] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-2 duration-300">
            {/* Header Fijo */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex-none shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10">
                {/* Title Section */}
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
                            Análisis Financiero Detallado
                        </span>
                        <span className="text-slate-400 font-mono text-xs font-bold">
                            #{(analysisModal.quote.id?.toString() || '').padStart(3, '0')}
                        </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-blue-950 uppercase tracking-tight truncate max-w-2xl">
                        {analysisModal.quote.empresa}
                    </h2>
                    <p className="text-xs font-bold text-slate-500">
                        {analysisModal.quote.contacto}
                    </p>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    
                    {/* Inline Notification for Rate Update */}
                    {rateStatus === 'success' && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 animate-in fade-in mr-2 flex items-center">
                            <FiCheck className="mr-1"  /> T.C. Actualizado
                        </span>
                    )}
                    {rateStatus === 'error' && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 animate-in fade-in mr-2 flex items-center">
                            <FiAlertCircle className="mr-1"  /> Error al guardar
                        </span>
                    )}

                    <div className="flex items-center bg-white rounded-xl p-2 border border-slate-200 mr-2 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500 px-2 uppercase tracking-widest border-r border-slate-200">T.C.</span>
                        <input 
                            type="number" 
                            className="w-24 bg-transparent text-sm font-black text-blue-900 outline-none px-2 text-center"
                            // Bind directo al estado sin fallback global. Muestra vacío si es undefined o 0.
                            value={analysisModal.quote.exchangeRate === undefined || analysisModal.quote.exchangeRate === 0 || analysisModal.quote.exchangeRate === null ? '' : analysisModal.quote.exchangeRate}
                            onChange={(e) => handleLocalRateChange(e.target.value)}
                            onBlur={handlePersistRate}
                            placeholder="0"
                            title="Editar Tipo de Cambio para este proyecto"
                            step="any"
                        />
                        <div 
                            role="button"
                            tabIndex={0}
                            onClick={handlePersistRate}
                            className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-100 transition-colors ml-1 cursor-pointer flex items-center justify-center"
                            title="Guardar Tasa"
                        >
                            <FiSave className="text-xs"  />
                        </div>
                    </div>

                    <IconButton 
                        icon={<ACTION_ICONS.excel />} 
                        onClick={() => handleExportDetailExcel(analysisModal.quote!, getAnalysisDetails(analysisModal.quote!)!.entries)}
                        variant="success"
                        title="Exportar Detalle Excel"
                    />
                    <IconButton 
                        icon={<ACTION_ICONS.pdf />} 
                        onClick={() => handleExportDetailPDF(analysisModal.quote!, getAnalysisDetails(analysisModal.quote!)!.entries)}
                        variant="danger"
                        title="Exportar Detalle PDF"
                    />

                    <div className="w-px h-8 bg-slate-200 mx-2"></div>

                    <IconButton 
                        icon={<ACTION_ICONS.reject />} 
                        onClick={() => setAnalysisModal({ show: false, quote: null })}
                        variant="neutral"
                        title="Cerrar"
                    />
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50/50">
                <div className="w-full">
                    {(() => {
                        // RE-CÁLCULO REACTIVO: Se ejecuta en cada render del modal cuando analysisModal.quote cambia
                        const details = getAnalysisDetails(analysisModal.quote);
                        
                        if (!details) return <div>Cargando...</div>;

                        const primaryCurrency = details.primaryCurrency;
                        const secondaryCurrency = details.secondaryCurrency;
                        
                        const visibleEntries = details.entries.slice(0, 10);
                        const totalVisibleUSD = visibleEntries.reduce((acc, e) => e.currency === 'USD' ? acc + e.amount : acc, 0);
                        const totalVisibleCRC = visibleEntries.reduce((acc, e) => e.currency === 'CRC' ? acc + e.amount : acc, 0);

                        // --- LÓGICA DE FORECAST / UTILIDAD ---
                        // Si hay ingresos reales > 0, mostramos Utilidad Real.
                        // Si NO hay ingresos reales, mostramos la Proyección (Presupuesto - Costos).
                        // OJO: Si falta tasa, los valores secundarios serán null
                        const hasRealIncome = details.income.primary !== null && details.income.primary > 0;
                        
                        // Valores a mostrar en la tarjeta de utilidad
                        const displayUtilityPrimary = hasRealIncome ? details.utility.primary : details.projection.primary;
                        const displayUtilitySecondary = hasRealIncome ? details.utility.secondary : details.projection.secondary;
                        
                        // Riesgo: Si no hay ingresos reales y la proyección es negativa (Costos superan Presupuesto)
                        // Si es null, no podemos determinar riesgo
                        const isProjectedRisk = !hasRealIncome && displayUtilityPrimary !== null && displayUtilityPrimary < 0;

                        // Color de tarjeta de utilidad
                        let utilityCardClass = 'bg-slate-50 border-slate-200'; // Default Neutral (si es null)
                        let textClass = 'text-slate-400';
                        
                        if (displayUtilityPrimary !== null) {
                            if (displayUtilityPrimary >= 0) {
                                utilityCardClass = hasRealIncome ? 'bg-blue-50 border-blue-200' : 'bg-indigo-50 border-indigo-200';
                                textClass = hasRealIncome ? 'text-blue-600' : 'text-indigo-600';
                            } else {
                                utilityCardClass = 'bg-rose-50 border-rose-200';
                                textClass = 'text-rose-600';
                            }
                        }

                        return (
                            <div className="space-y-8">
                                
                                {/* ALERTA FALTA T.C. */}
                                {!details.hasValidRate && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-center shadow-sm animate-in fade-in slide-in-from-top-2">
                                        <FiAlertTriangle className="text-amber-500 text-xl"  />
                                        <div>
                                            <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight">Tipo de Cambio no definido</h4>
                                            <p className="text-xs font-bold text-amber-700">
                                                Los valores convertidos se calcularán automáticamente al ingresar una tasa válida en la barra superior.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Dashboard Cards - Dual Currency - OPTIMIZED FOR MOBILE 2-COL */}
                                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                    <div className="bg-white border border-slate-200 rounded-2xl p-3 md:p-6 relative overflow-hidden shadow-sm">
                                        <div className="absolute top-0 right-0 p-2 md:p-3 opacity-10"><FiFileText className="text-3xl md:text-5xl text-slate-600"  /></div>
                                        <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 md:mb-2">Presupuesto</p>
                                        <p className="text-sm sm:text-lg md:text-2xl font-black text-slate-700">{formatCurrency(details.budget.primary, primaryCurrency)}</p>
                                        <div className="text-[9px] md:text-xs font-bold text-slate-400 mt-0.5 md:mt-1">
                                            {renderFinancialValue(details.budget.secondary, secondaryCurrency)}
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 md:p-6 relative overflow-hidden shadow-sm">
                                        <div className="absolute top-0 right-0 p-2 md:p-3 opacity-10"><FiDatabase className="text-3xl md:text-5xl text-emerald-600"  /></div>
                                        <p className="text-[9px] md:text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1 md:mb-2">Ingresos Reales</p>
                                        <p className="text-sm sm:text-lg md:text-2xl font-black text-emerald-600">
                                            {renderFinancialValue(details.income.primary, primaryCurrency)}
                                        </p>
                                        <div className="text-[9px] md:text-xs font-bold text-emerald-600/60 mt-0.5 md:mt-1">
                                            {renderFinancialValue(details.income.secondary, secondaryCurrency)}
                                        </div>
                                    </div>
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-3 md:p-6 relative overflow-hidden shadow-sm">
                                        <div className="absolute top-0 right-0 p-2 md:p-3 opacity-10"><FiTrendingUp className="text-3xl md:text-5xl text-red-600"  /></div>
                                        <p className="text-[9px] md:text-[10px] font-black text-red-800 uppercase tracking-widest mb-1 md:mb-2">Costos Reales</p>
                                        <p className="text-sm sm:text-lg md:text-2xl font-black text-red-600">
                                            {renderFinancialValue(details.costs.primary, primaryCurrency)}
                                        </p>
                                        <div className="text-[9px] md:text-xs font-bold text-red-600/60 mt-0.5 md:mt-1">
                                            {renderFinancialValue(details.costs.secondary, secondaryCurrency)}
                                        </div>
                                    </div>
                                    
                                    {/* CARD DE UTILIDAD INTELIGENTE (FORECAST vs REAL) */}
                                    <div 
                                        className={`border rounded-2xl p-3 md:p-6 relative overflow-hidden shadow-sm ${utilityCardClass}`}
                                        title={hasRealIncome ? "Utilidad basada en ingresos reales" : "Esta utilidad es una proyección basada en ingresos aprobados y costos registrados. No representa utilidad contable definitiva."}
                                    >
                                        <div className="absolute top-0 right-0 p-2 md:p-3 opacity-10">
                                            {hasRealIncome ? <FiActivity className="text-3xl md:text-5xl text-blue-600" /> : <FiPieChart className="text-3xl md:text-5xl text-blue-600" />}
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2 ${displayUtilityPrimary !== null && displayUtilityPrimary >= 0 ? (hasRealIncome ? 'text-blue-800' : 'text-indigo-800') : (displayUtilityPrimary !== null ? 'text-rose-800' : 'text-slate-500')}`}>
                                                {hasRealIncome ? "Utilidad Neta" : "Utilidad Proyectada"}
                                            </p>
                                            
                                            {/* Badge Dinámico: Margen Real vs Forecast vs Riesgo */}
                                            {displayUtilityPrimary !== null && (
                                                hasRealIncome ? (
                                                    <span className={`px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[8px] md:text-[9px] font-black ${details.overall.margin >= 0 ? 'bg-white/50 text-blue-800' : 'bg-white/50 text-rose-800'}`}>
                                                        {details.overall.margin.toFixed(1)}% Margen
                                                    </span>
                                                ) : (
                                                    <span className={`px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[8px] md:text-[9px] font-black border ${isProjectedRisk ? 'bg-red-100 text-red-700 border-red-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                                                        {isProjectedRisk ? "RIESGO" : `${details.overall.projectedMargin.toFixed(1)}% Proy.`}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                        
                                        <p className={`text-sm sm:text-lg md:text-2xl font-black ${textClass}`}>
                                            {renderFinancialValue(displayUtilityPrimary, primaryCurrency)}
                                        </p>
                                        <div className={`text-[9px] md:text-xs font-bold mt-0.5 md:mt-1 opacity-60`}>
                                            {renderFinancialValue(displayUtilitySecondary, secondaryCurrency)}
                                        </div>

                                        {/* Subtexto Informativo si es Real (Muestra la proyección debajo) */}
                                        {hasRealIncome && details.projection.primary !== null && (
                                            <p className="text-[8px] md:text-[9px] font-bold text-slate-400 mt-2 border-t border-slate-200/50 pt-1">
                                                Proyección total: {formatCurrency(details.projection.primary, primaryCurrency)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Desglose de Costos */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-2">Desglose de Costos</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(details.breakdown).map(([category, vals]) => {
                                            const values = vals as { primary: number; secondary: number; items: number; isPartial: boolean };
                                            return (
                                            <div key={category} className="flex items-center justify-between p-5 bg-white rounded-xl border border-slate-100 hover:border-slate-200 shadow-sm transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                                                        {category === 'Costo de Proyecto' ? <FiHardDrive className="text-lg" /> : category === 'Gasto Operativo' ? <FiTool className="text-lg" /> : <FiFileText className="text-lg" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-700 uppercase">{category}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">{values.items} movimiento(s)</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-base font-black text-slate-700">
                                                        {renderFinancialValue(values.isPartial ? null : values.primary, primaryCurrency)}
                                                    </p>
                                                    <div className="text-[10px] font-bold text-slate-400">
                                                        {renderFinancialValue(values.isPartial ? null : values.secondary, secondaryCurrency)}
                                                    </div>
                                                </div>
                                            </div>
                                        )})}
                                        
                                        {/* Reportes de Materiales */}
                                        <div 
                                            onClick={() => setMaterialsModal({ show: true, quote: analysisModal.quote })}
                                            className="flex items-center justify-between p-5 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 shadow-sm transition-all cursor-pointer group"
                                            title="Click para ver detalle de materiales"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                                    <FiBox className="text-lg"  />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-700 uppercase">Materiales Consumidos</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{details.materialQuantity || 0} unidades</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-base font-black text-emerald-600">
                                                    {renderFinancialValue(details.materialCostPrimary || 0, primaryCurrency)}
                                                </p>
                                                <div className="text-[10px] font-bold text-slate-400">
                                                    {renderFinancialValue(details.materialCostSecondary || 0, secondaryCurrency)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabla de Movimientos Recientes */}
                                <div>
                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Movimientos Recientes</h4>
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                                        {/* eslint-disable-next-line no-restricted-syntax */}
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                <tr>
                                                    <th className="p-4">Fecha</th>
                                                    <th className="p-4">Descripción</th>
                                                    <th className="p-4 text-center">Tipo</th>
                                                    <th className="p-4 text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-xs divide-y divide-slate-100">
                                                {visibleEntries.map(entry => (
                                                    <tr key={entry.id} className="hover:bg-slate-50">
                                                        <td className="p-4 font-mono text-slate-500 font-bold">{entry.date}</td>
                                                        <td className="p-4 font-bold text-slate-700">{entry.description}</td>
                                                        <td className="p-4 text-center">
                                                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${entry.type === 'Ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                                {entry.subtype || entry.type}
                                                            </span>
                                                        </td>
                                                        <td className={`p-4 text-right font-mono font-bold text-sm ${entry.type === 'Ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {formatCurrency(entry.amount, entry.currency)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {visibleEntries.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">No hay movimientos registrados.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-50/80 border-t border-slate-200">
                                                    <td colSpan={3} className="p-4 text-right font-black text-slate-500 text-[10px] uppercase tracking-widest align-top pt-5">Total Movimientos (Visibles)</td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {totalVisibleUSD > 0 && <span className="font-mono font-black text-slate-700 text-sm">{formatCurrency(totalVisibleUSD, 'USD')}</span>}
                                                            {totalVisibleCRC > 0 && <span className="font-mono font-bold text-slate-500 text-xs">{formatCurrency(totalVisibleCRC, 'CRC')}</span>}
                                                            {totalVisibleUSD === 0 && totalVisibleCRC === 0 && <span className="font-mono font-bold text-slate-400 text-xs">--</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* Modal de Detalle de Materiales */}
      {materialsModal.show && materialsModal.quote && createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[9500] p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight flex items-center gap-2">
                            <FiBox className="text-emerald-600" /> Detalle de Materiales
                        </h3>
                        <p className="text-xs font-bold text-slate-400 mt-1">
                            Proyecto: <span className="text-blue-900">{materialsModal.quote.empresa}</span> (#{materialsModal.quote.id})
                        </p>
                    </div>
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={() => setMaterialsModal({ show: false, quote: null })}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 transition-all shadow-sm cursor-pointer"
                    >
                        <FiX className="text-lg" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    {(() => {
                        const movements = inventoryMovements.filter(m => 
                            m.projectId === materialsModal.quote?.id?.toString() && 
                            (m.type === 'Salida' || m.type === 'Devolución')
                        );

                        const materialSummary: Record<string, { 
                            code: string, 
                            description: string, 
                            quantity: number, 
                            price: number, 
                            currency: 'USD' | 'CRC' 
                        }> = {};

                        movements.forEach(m => {
                            const factor = m.type === 'Devolución' ? -1 : 1;
                            const processItem = (itemId: string, qty: number, hPrice?: number, hCurrency?: 'USD' | 'CRC') => {
                                const invItem = inventoryItems.find(i => i.id === itemId);
                                
                                const key = itemId;
                                if (!materialSummary[key]) {
                                    materialSummary[key] = {
                                        code: invItem?.code || 'N/A',
                                        description: invItem?.description || 'Sin descripción',
                                        quantity: 0,
                                        price: hPrice !== undefined ? hPrice : (invItem?.price || 0),
                                        currency: hCurrency || (invItem?.currency || 'USD')
                                    };
                                }
                                materialSummary[key].quantity += (qty * factor);
                            };

                            if (m.items && m.items.length > 0) {
                                m.items.forEach(item => processItem(item.inventoryItemId, item.quantity, item.unitPrice, item.currency));
                            } else {
                                processItem(m.inventoryItemId, m.quantity, m.unitPrice, m.currency);
                            }
                        });

                        const rows = Object.values(materialSummary).filter(m => m.quantity !== 0);

                        // Calcular totales por moneda
                        const totalCRC = rows.reduce((acc, row) => row.currency === 'CRC' ? acc + (row.quantity * row.price) : acc, 0);
                        const totalUSD = rows.reduce((acc, row) => row.currency === 'USD' ? acc + (row.quantity * row.price) : acc, 0);

                        return (
                            <>
                                {/* Resumen de Totales */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl shadow-sm flex flex-col relative overflow-hidden group hover:border-blue-200 transition-colors">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <FiTrendingUp className="text-4xl text-blue-900" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Consumido (CRC)</span>
                                        <span className="text-2xl font-black text-blue-900">
                                            {formatCurrency(totalCRC, 'CRC')}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl shadow-sm flex flex-col relative overflow-hidden group hover:border-emerald-200 transition-colors">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <FiTrendingUp className="text-4xl text-emerald-600" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Consumido (USD)</span>
                                        <span className="text-2xl font-black text-emerald-600">
                                            {formatCurrency(totalUSD, 'USD')}
                                        </span>
                                    </div>
                                </div>

                                <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
                                    {/* eslint-disable-next-line no-restricted-syntax */}
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cantidad</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio Unit.</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {rows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 font-bold text-xs italic">
                                                        No se encontraron movimientos de materiales registrados para este proyecto.
                                                    </td>
                                                </tr>
                                            ) : (
                                                rows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-4 text-xs font-black text-blue-900">{row.code}</td>
                                                        <td className="px-4 py-4 text-xs font-bold text-slate-600 uppercase">{row.description}</td>
                                                        <td className="px-4 py-4 text-xs font-black text-slate-700 text-center">
                                                            <span className={row.quantity < 0 ? 'text-red-600' : ''}>
                                                                {row.quantity}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-xs font-bold text-slate-500 text-right">
                                                            {formatCurrency(row.price, row.currency)}
                                                        </td>
                                                        <td className="px-4 py-4 text-xs font-black text-slate-900 text-right">
                                                            {formatCurrency(row.quantity * row.price, row.currency)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        );
                    })()}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={() => setMaterialsModal({ show: false, quote: null })}
                        className="px-8 py-3 bg-blue-900 text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-blue-800 transition-all cursor-pointer text-center"
                    >
                        Cerrar Detalle
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deleteModal.show && deleteModal.row && createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[9000] p-4">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            {deleteModal.isBlocked ? (
                <>
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiAlertCircle className="text-2xl"  />
                    </div>
                    <h3 className="text-xl font-black text-blue-950 mb-2">Eliminación Bloqueada</h3>
                    <p className="text-slate-500 text-sm font-bold mb-4">
                        Este proyecto tiene información asociada y no puede ser eliminado del análisis:
                    </p>
                    <div className="bg-red-50 rounded-2xl p-4 mb-6 text-left">
                        <ul className="space-y-1">
                            {deleteModal.blockReason?.map((reason, idx) => (
                                <li key={idx} className="text-xs font-bold text-red-700 flex items-center gap-2">
                                    <div className="w-1 h-1 bg-red-400 rounded-full" />
                                    {reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={() => setDeleteModal({ show: false, row: null })} 
                        className="w-full py-3 bg-slate-100 text-slate-500 font-black uppercase text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer text-center"
                    >
                        Entendido
                    </div>
                </>
            ) : (
                <>
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiAlertTriangle className="text-2xl"  />
                    </div>
                    <h3 className="text-xl font-black text-blue-950 mb-2">¿Eliminar Análisis?</h3>
                    <p className="text-slate-500 text-sm font-bold mb-2">
                        Estás a punto de eliminar el análisis financiero para:
                    </p>
                    <p className="text-blue-900 font-black text-sm mb-6 bg-blue-50 py-2 rounded-lg">
                        {deleteModal.row.client} (#{(deleteModal.row.id?.toString() || '').padStart(3, '0')})
                    </p>
                    <p className="text-xs text-slate-400 font-bold mb-8">
                        Esta acción no se puede deshacer. El proyecto dejará de aparecer en los reportes financieros.
                    </p>
                    
                    <div className="flex gap-3">
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={isDeleting ? undefined : () => setDeleteModal({ show: false, row: null })} 
                        className={`flex-1 py-3 text-slate-500 font-black uppercase text-xs hover:text-slate-700 transition-colors bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer text-center ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        Cancelar
                    </div>
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={isDeleting ? undefined : confirmDelete} 
                        className={`flex-1 py-3 bg-red-600 text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 cursor-pointer text-center ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        {isDeleting ? (
                            <>
                                <FiLoader className="animate-spin"  /> Eliminando...
                            </>
                        ) : (
                            'Confirmar'
                        )}
                    </div>
                    </div>
                </>
            )}
          </div>
        </div>,
        document.body
      )}
        {/* --- MODAL DE RESTAURACIÓN (NUEVO ANÁLISIS) --- */}
        {restoreModal && createPortal(
            <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[600] p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl p-8 flex flex-col max-h-[80vh]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Nuevo Análisis</h3>
                            <p className="text-xs font-bold text-slate-400">Seleccione un proyecto aprobado para analizar</p>
                        </div>
                        <IconButton 
                            variant="neutral" 
                            icon={<FiX className="text-xl" />} 
                            onClick={() => setRestoreModal(false)} 
                        />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {quotes.filter(q => q.estado === 'Aprobada' && q.analysisHidden).length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-bold text-xs">
                                No hay proyectos aprobados pendientes de análisis.
                            </div>
                        ) : (
                            quotes.filter(q => q.estado === 'Aprobada' && q.analysisHidden).map(q => (
                                <div key={q.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-all group">
                                    <div>
                                        <p className="font-black text-blue-900 text-xs">{q.empresa}</p>
                                        <p className="text-[10px] font-bold text-slate-500">Cotización #{q.id} - {formatCurrency(q.monto, q.moneda)}</p>
                                    </div>
                                    <ActionButton 
                                        variant="secondary"
                                        label="Crear Análisis"
                                        onClick={() => handleRestore(q)}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
    );
};

export default ProjectAnalysisModule;
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryMovement } from '../inventoryMovementTypes';
import { InventoryItem } from '../inventoryTypes';
import { User } from '../utils/types';
import { formatCurrency } from '../utils/formatCurrency';
import { isAdmin } from '../utils/permissions';
import { normalizeOrigin } from '../utils/originUtils';
import { DataTable, TableColumn, ActionButton, SearchInput, Select, StatusBadge } from '../design-system';
import { 
  FiCircle, 
  FiDatabase, 
  FiAlertTriangle, 
  FiSearch, 
  FiFileText, 
  FiTable, 
  FiLayers, 
  FiCheckCircle, 
  FiCalendar, 
  FiHash,
  FiMapPin,
  FiX
} from "react-icons/fi";
import { generateProjectConsumptionPDF } from '../utils/pdfGenerator';
import { exportConsumptionToExcel } from '../utils/export/inventoryExport';

interface ProjectConsumptionModuleProps {
  movements: InventoryMovement[];
  inventoryItems: InventoryItem[];
  currentUser: User;
  dispatches?: any[];
  initialSearch?: string;
}

interface MaterialConsumption {
  materialId: string;
  code: string;
  description: string;
  unit: string;
  totalQuantity: number;
  unitPrice: number;
  currency: 'USD' | 'CRC';
  totalCost: number;
}

export const ProjectConsumptionModule: React.FC<ProjectConsumptionModuleProps> = ({ 
  movements, 
  inventoryItems, 
  currentUser,
  dispatches = [],
  initialSearch = ''
}) => {
  const isUserAdmin = isAdmin(currentUser.role);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('');
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);

  // Sincronizar búsqueda inicial si cambia desde fuera
  useEffect(() => {
    if (initialSearch && initialSearch !== searchTerm) {
      setSearchTerm(initialSearch);
      setSelectedMovementId(null);
    }
  }, [initialSearch]);

  // Resetear selección individual al cambiar término de búsqueda
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setSelectedMovementId(null);
    if (selectedProjectFilter && val !== selectedProjectFilter) {
      setSelectedProjectFilter('');
    }
  };

  // 1. Obtener lista de proyectos / FDHs únicos agrupados
  const availableProjects = useMemo(() => {
    const map = new Map<string, { label: string; value: string; fdh: string; projectName: string; count: number }>();
    
    (movements || []).forEach(m => {
      if (m.type === 'Salida' || m.type === 'Devolución') {
        const fdh = (m.fdh || '').trim();
        const projName = (m.projectName || '').trim();
        const projCode = (m.projectCode || '').trim();
        
        // Agrupar preferentemente por FDH o por nombre de proyecto
        const groupKey = fdh ? `FDH:${fdh}` : (projName ? `PROJ:${projName}` : `ID:${m.projectId || m.id}`);
        
        const labelParts: string[] = [];
        if (fdh) labelParts.push(fdh);
        if (projCode) labelParts.push(`[${projCode}]`);
        if (projName) labelParts.push(projName);
        const label = labelParts.length > 0 ? labelParts.join(' - ') : (m.origin || 'SIN-PROYECTO');

        if (map.has(groupKey)) {
          map.get(groupKey)!.count += 1;
        } else {
          map.set(groupKey, {
            label,
            value: fdh || projName || m.projectId || m.id,
            fdh,
            projectName: projName,
            count: 1
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [movements]);

  // 2. Movimientos coincidentes con la búsqueda o filtro
  const matchingMovements = useMemo(() => {
    const rawQuery = searchTerm.trim().toLowerCase();
    const relevantMovements = (movements || []).filter(m => m.type === 'Salida' || m.type === 'Devolución');

    if (!rawQuery && !selectedProjectFilter) {
      return [];
    }

    return relevantMovements.filter(m => {
      // Si hay un filtro exacto de proyecto seleccionado
      if (selectedProjectFilter) {
        const matchesFilter = (m.fdh && m.fdh.toLowerCase() === selectedProjectFilter.toLowerCase()) ||
          (m.projectName && m.projectName.toLowerCase() === selectedProjectFilter.toLowerCase()) ||
          (m.projectId && m.projectId === selectedProjectFilter);
        if (!matchesFilter && !rawQuery) return false;
      }

      if (!rawQuery) return true;

      const fdh = (m.fdh || '').toLowerCase();
      const reqNum = (m.requestNumber || '').toLowerCase();
      const projName = (m.projectName || '').toLowerCase();
      const projCode = (m.projectCode || '').toLowerCase();
      const torre = ((m.torre || (m as any).tower) || '').toLowerCase();
      const origin = (m.origin || '').toLowerCase();
      const location = (m.locationDetails || '').toLowerCase();
      const obs = (m.observations || '').toLowerCase();

      const itemsMatch = m.items 
        ? m.items.some(i => 
            (i.inventoryItemCode || '').toLowerCase().includes(rawQuery) || 
            (i.inventoryItemName || '').toLowerCase().includes(rawQuery)
          )
        : ((m.inventoryItemCode || '').toLowerCase().includes(rawQuery) || 
           (m.inventoryItemName || '').toLowerCase().includes(rawQuery));

      return fdh.includes(rawQuery) ||
             reqNum.includes(rawQuery) ||
             projName.includes(rawQuery) ||
             projCode.includes(rawQuery) ||
             torre.includes(rawQuery) ||
             origin.includes(rawQuery) ||
             location.includes(rawQuery) ||
             obs.includes(rawQuery) ||
             itemsMatch;
    }).sort((a, b) => {
      // Ordenar más recientes primero
      const dateA = a.date || a.createdAt || '';
      const dateB = b.date || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [movements, searchTerm, selectedProjectFilter]);

  // 3. Movimientos activos para el cálculo (Consolidado o Individual seleccionado)
  const activeMovements = useMemo(() => {
    if (selectedMovementId) {
      return matchingMovements.filter(m => m.id === selectedMovementId);
    }
    return matchingMovements;
  }, [matchingMovements, selectedMovementId]);

  // 4. Calcular consumo agrupado por material
  const consumptionData = useMemo(() => {
    if (activeMovements.length === 0) return [];

    const groupedData = new Map<string, MaterialConsumption>();

    activeMovements.forEach(m => {
      const factor = m.type === 'Devolución' ? -1 : 1;

      const processItem = (
        itemId: string, 
        rawQty: number, 
        itemCode?: string, 
        itemName?: string, 
        historicalPrice?: number, 
        historicalCurrency?: 'USD' | 'CRC',
        historicalCostTotal?: number
      ) => {
        const qty = Number(rawQty) || 0;
        if (qty === 0) return;

        const currentItem = inventoryItems.find(i => i.id === itemId || (itemCode && i.code === itemCode));
        const code = itemCode || currentItem?.code || '---';
        const description = itemName || currentItem?.description || 'Material';
        const unit = currentItem?.unit || 'Und';
        const price = (historicalPrice !== undefined && historicalPrice !== null)
          ? Number(historicalPrice) 
          : (Number(currentItem?.price) || 0);
        const currency = historicalCurrency || currentItem?.currency || 'USD';

        const adjustedQty = qty * factor;
        const adjustedCost = (historicalCostTotal !== undefined && historicalCostTotal !== null)
          ? Number(historicalCostTotal) * factor
          : (qty * price) * factor;

        const key = itemId || code;

        if (groupedData.has(key)) {
          const existing = groupedData.get(key)!;
          existing.totalQuantity += adjustedQty;
          existing.totalCost += adjustedCost;
          if (existing.totalQuantity > 0) {
            existing.unitPrice = Math.round((existing.totalCost / existing.totalQuantity) * 10000) / 10000;
          }
        } else {
          groupedData.set(key, {
            materialId: itemId || key,
            code,
            description,
            unit,
            totalQuantity: adjustedQty,
            unitPrice: price,
            currency,
            totalCost: adjustedCost
          });
        }
      };

      if (m.items && m.items.length > 0) {
        m.items.forEach(it => {
          processItem(
            it.inventoryItemId, 
            it.quantity, 
            it.inventoryItemCode, 
            it.inventoryItemName, 
            it.unitCost !== undefined ? it.unitCost : it.unitPrice, 
            it.currency,
            it.costTotal !== undefined ? it.costTotal : it.subtotal
          );
        });
      } else if (m.inventoryItemId || m.inventoryItemCode) {
        processItem(
          m.inventoryItemId, 
          m.quantity, 
          m.inventoryItemCode, 
          m.inventoryItemName, 
          (m as any).weightedUnitCost !== undefined ? (m as any).weightedUnitCost : m.unitPrice, 
          m.currency,
          (m as any).totalCost !== undefined ? (m as any).totalCost : m.subtotal
        );
      }
    });

    return Array.from(groupedData.values())
      .filter(item => item.totalQuantity !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [activeMovements, inventoryItems]);

  // 5. Totales y KPIs
  const totals = useMemo(() => {
    let usd = 0;
    let crc = 0;
    let totalItemsCount = 0;
    
    consumptionData.forEach(item => {
      if (item.currency === 'USD') {
        usd += item.totalCost;
      } else {
        crc += item.totalCost;
      }
      totalItemsCount += item.totalQuantity;
    });

    return { usd, crc, totalItemsCount };
  }, [consumptionData]);

  // 6. Metadata para Exportaciones
  const selectedExportMetadata = useMemo(() => {
    if (selectedMovementId) {
      return matchingMovements.find(m => m.id === selectedMovementId) || matchingMovements[0];
    }
    if (matchingMovements.length > 0) {
      const first = matchingMovements[0];
      const reqNumbers = Array.from(new Set(matchingMovements.map(m => m.requestNumber).filter(Boolean)));
      return {
        origin: first.origin,
        projectName: first.projectName || searchTerm,
        projectCode: first.projectCode,
        fdh: first.fdh || searchTerm,
        torre: first.torre || (first as any).tower,
        locationDetails: first.locationDetails,
        requestNumber: reqNumbers.length > 0 
          ? reqNumbers.join(', ') 
          : `Consolidado (${matchingMovements.length} salidas)`,
        date: matchingMovements.length === 1 
          ? first.date 
          : `${matchingMovements[matchingMovements.length - 1].date} al ${matchingMovements[0].date}`
      };
    }
    return null;
  }, [selectedMovementId, matchingMovements, searchTerm]);

  // Exportar Excel
  const handleExportExcel = () => {
    const title = selectedMovementId
      ? `${selectedExportMetadata?.requestNumber || 'Salida'}_${selectedExportMetadata?.fdh || selectedExportMetadata?.projectName || 'Consumo'}`
      : `${selectedExportMetadata?.fdh || searchTerm || 'Consumo'}_Consolidado`;
    exportConsumptionToExcel(title, consumptionData, selectedExportMetadata);
  };

  // Exportar PDF
  const handleExportPdf = () => {
    const title = selectedMovementId
      ? `${selectedExportMetadata?.requestNumber || 'Salida'} - ${selectedExportMetadata?.projectName || selectedExportMetadata?.fdh || 'Consumo'}`
      : `${selectedExportMetadata?.fdh || searchTerm || 'Consumo'} (Consolidado)`;
    generateProjectConsumptionPDF(title, consumptionData, totals, isUserAdmin, selectedExportMetadata);
  };

  // Columnas para DataTable de Materiales Consumidos
  const columns = useMemo<TableColumn<MaterialConsumption>[]>(() => {
    const cols: TableColumn<MaterialConsumption>[] = [
      { 
        header: 'Código', 
        accessorKey: 'code', 
        width: '120px',
        className: 'font-mono font-bold text-slate-600' 
      },
      { 
        header: 'Descripción del Material', 
        accessorKey: 'description', 
        className: 'font-bold text-blue-950' 
      },
      { 
        header: 'Unidad', 
        accessorKey: 'unit', 
        width: '90px',
        align: 'center',
        className: 'text-slate-500 font-bold text-xs'
      },
      { 
        header: 'Cant. Total', 
        width: '120px',
        align: 'right',
        render: (item) => (
          <span className="font-black text-slate-800 text-sm font-mono">
            {item.totalQuantity.toLocaleString('es-CR', { maximumFractionDigits: 2 })}
          </span>
        )
      }
    ];

    if (isUserAdmin) {
      cols.push(
        { 
          header: 'Precio U.', 
          width: '120px',
          align: 'right',
          render: (item) => (
            <span className="font-mono text-xs text-slate-500">
              {formatCurrency(item.unitPrice, item.currency)}
            </span>
          )
        },
        { 
          header: 'Subtotal', 
          width: '140px',
          align: 'right',
          render: (item) => (
            <span className="font-mono font-black text-emerald-600 text-sm">
              {formatCurrency(item.totalCost, item.currency)}
            </span>
          )
        }
      );
    }

    return cols;
  }, [isUserAdmin]);

  const hasSearch = searchTerm.trim().length > 0 || Boolean(selectedProjectFilter);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            
            {/* Buscador Abierto en Tiempo Real */}
            <div className="flex-1 w-full">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Búsqueda por FDH, Solicitud o Proyecto
              </label>
              <SearchInput 
                placeholder="Escribe FDH (ej. FDH0103), SOL-0167, nombre de proyecto..." 
                value={searchTerm} 
                onChange={(e) => handleSearchChange(e.target.value)} 
                className="w-full"
              />
            </div>

            {/* Selector de Proyecto/FDH Rápido */}
            <div className="w-full md:w-80">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                O Seleccionar Proyecto / FDH
              </label>
              <Select
                options={[
                  { label: '-- Todos los Proyectos / FDH --', value: '' },
                  ...availableProjects.map(p => ({
                    label: `${p.label} (${p.count} ${p.count === 1 ? 'salida' : 'salidas'})`,
                    value: p.value
                  }))
                ]}
                value={selectedProjectFilter}
                onChange={val => {
                  setSelectedProjectFilter(val);
                  setSearchTerm(val);
                  setSelectedMovementId(null);
                }}
                className="w-full text-xs"
                isSearchable={true}
              />
            </div>

            {/* Botones de Exportación */}
            {hasSearch && matchingMovements.length > 0 && (
              <div className="flex gap-2 w-full md:w-auto justify-end pt-3 md:pt-4">
                <ActionButton
                  onClick={handleExportExcel}
                  label="Excel"
                  icon={<FiTable className="text-lg" />}
                  variant="success"
                  size="md"
                />
                <ActionButton
                  onClick={handleExportPdf}
                  label="PDF"
                  icon={<FiFileText className="text-lg" />}
                  variant="danger"
                  size="md"
                />
              </div>
            )}
          </div>

          {/* Indicador de Búsqueda Activa */}
          {hasSearch && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Filtrando por:</span>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded-lg border border-blue-200">
                  {searchTerm || selectedProjectFilter}
                </span>
                <span className="text-xs text-slate-400">
                  ({matchingMovements.length} {matchingMovements.length === 1 ? 'registro encontrado' : 'registros encontrados'})
                </span>
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedProjectFilter('');
                  setSelectedMovementId(null);
                }}
                className="text-xs text-slate-400 hover:text-red-600 font-bold flex items-center gap-1 transition-colors"
              >
                <FiX className="text-sm" /> Limpiar búsqueda
              </button>
            </div>
          )}
        </div>

        {/* CONTENIDO CUANDO HAY RESULTADOS */}
        {hasSearch && matchingMovements.length > 0 && (
          <>
            {/* TARJETAS DE RESUMEN (KPIS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Costo USD (Admin) */}
              {isUserAdmin && (
                <div className="bg-emerald-50/80 border border-emerald-200 p-5 rounded-2xl flex justify-between items-center shadow-xs">
                  <div>
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                      Costo Total USD
                    </p>
                    <p className="text-2xl font-black text-emerald-600 font-mono mt-1">
                      {formatCurrency(totals.usd, 'USD')}
                    </p>
                    <span className="text-[10px] text-emerald-700/80 font-medium">
                      {selectedMovementId ? 'Registro individual' : 'Consolidado del proyecto'}
                    </span>
                  </div>
                  <div className="w-11 h-11 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 text-xl shadow-xs">
                    <FiCircle />
                  </div>
                </div>
              )}

              {/* Costo CRC (Admin) */}
              {isUserAdmin && (
                <div className="bg-blue-50/80 border border-blue-200 p-5 rounded-2xl flex justify-between items-center shadow-xs">
                  <div>
                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
                      Costo Total Colones
                    </p>
                    <p className="text-2xl font-black text-blue-600 font-mono mt-1">
                      {formatCurrency(totals.crc, 'CRC')}
                    </p>
                    <span className="text-[10px] text-blue-700/80 font-medium">
                      {selectedMovementId ? 'Registro individual' : 'Consolidado del proyecto'}
                    </span>
                  </div>
                  <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 text-xl shadow-xs">
                    <FiDatabase />
                  </div>
                </div>
              )}

              {/* Total Unidades de Materiales */}
              <div className="bg-purple-50/80 border border-purple-200 p-5 rounded-2xl flex justify-between items-center shadow-xs">
                <div>
                  <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest">
                    Materiales Consumidos
                  </p>
                  <p className="text-2xl font-black text-purple-700 font-mono mt-1">
                    {totals.totalItemsCount.toLocaleString('es-CR', { maximumFractionDigits: 2 })} <span className="text-sm font-bold text-purple-500">Und</span>
                  </p>
                  <span className="text-[10px] text-purple-600 font-medium">
                    {consumptionData.length} códigos distintos
                  </span>
                </div>
                <div className="w-11 h-11 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 text-xl shadow-xs">
                  <FiLayers />
                </div>
              </div>

              {/* Cantidad de Registros / Movimientos */}
              <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-2xl flex justify-between items-center shadow-xs">
                <div>
                  <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                    Salidas Registradas
                  </p>
                  <p className="text-2xl font-black text-amber-700 font-mono mt-1">
                    {matchingMovements.length} <span className="text-sm font-bold text-amber-500">{matchingMovements.length === 1 ? 'salida' : 'salidas'}</span>
                  </p>
                  <span className="text-[10px] text-amber-700 font-medium">
                    {selectedMovementId ? 'Filtrando 1 salida' : 'Mostrando todas'}
                  </span>
                </div>
                <div className="w-11 h-11 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 text-xl shadow-xs">
                  <FiCheckCircle />
                </div>
              </div>

            </div>

            {/* ALERTA MULTIMONEDA */}
            {totals.usd > 0 && totals.crc > 0 && isUserAdmin && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-3 items-center">
                <FiAlertTriangle className="text-amber-500 flex-none" />
                <p className="text-xs font-bold text-amber-800">
                  Este proyecto contiene materiales costeados en diferentes monedas (USD y CRC). Los montos se presentan desglosados en las tarjetas superiores.
                </p>
              </div>
            )}

            {/* SECCIÓN: REGISTROS ENCONTRADOS / SOLICITUDES ASOCIADAS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h4 className="text-xs font-black text-blue-950 uppercase tracking-widest">
                    Registros y Salidas Asociadas ({matchingMovements.length})
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Selecciona un registro individual para ver su consumo específico o mantén el consolidado para ver el total del proyecto.
                  </p>
                </div>

                {/* Botón para volver al consolidado completo */}
                <button
                  onClick={() => setSelectedMovementId(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedMovementId === null 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FiLayers /> Ver Consolidado Completo ({matchingMovements.length})
                </button>
              </div>

              {/* Lista de Registros Coincidentes */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {matchingMovements.map((m, idx) => {
                  const isSelected = selectedMovementId === m.id;
                  const reqNumber = m.requestNumber || 'SIN-ID';
                  const dateStr = m.date || '---';
                  const fdhCode = m.fdh || '---';
                  const torreCode = m.torre || (m as any).tower || '';
                  const itemsCount = m.items?.length || 1;
                  const isAssignment = m.isAssignment || m.originType === 'herramientas_asignadas';

                  return (
                    <div 
                      key={m.id || idx}
                      onClick={() => setSelectedMovementId(isSelected ? null : m.id)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all text-left flex flex-col justify-between ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-200 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        {/* Cabecera del Registro */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border ${
                            reqNumber !== 'SIN-ID'
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {reqNumber}
                          </span>
                          <StatusBadge 
                            label={m.type === 'Devolución' ? 'DEVOLUCIÓN' : 'SALIDA'} 
                            variant={m.type === 'Devolución' ? 'warning' : 'danger'} 
                          />
                        </div>

                        {/* Proyecto y Origen */}
                        <p className="text-xs font-bold text-blue-950 line-clamp-2 leading-snug">
                          {m.projectName || normalizeOrigin(m.origin || 'Proyecto')}
                        </p>
                        {m.projectCode && (
                          <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
                            [{m.projectCode}]
                          </span>
                        )}

                        {/* Detalles de Ubicación (FDH, Torre, Fecha) */}
                        <div className="mt-3 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-400 font-bold block">FDH / TORRE:</span>
                            <span className="font-mono font-bold text-slate-700">
                              {fdhCode} {torreCode ? `• ${torreCode}` : ''}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 font-bold block">FECHA:</span>
                            <span className="font-medium text-slate-600 flex items-center justify-end gap-1">
                              <FiCalendar className="text-slate-400" /> {dateStr}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer del card */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {itemsCount} {itemsCount === 1 ? 'material' : 'materiales'}
                        </span>
                        <span className={`text-[10px] font-bold ${
                          isSelected ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                        }`}>
                          {isSelected ? '✓ Seleccionado' : 'Click para filtrar'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABLA DE CONSUMO DE MATERIALES CONSOLIDADA */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-blue-950 uppercase tracking-widest">
                    Detalle de Materiales Consumidos
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedMovementId 
                      ? 'Desglose del registro seleccionado' 
                      : `Consolidado de materiales para ${searchTerm || selectedProjectFilter} (${matchingMovements.length} salidas)`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-600">
                    {consumptionData.length} {consumptionData.length === 1 ? 'ítem listado' : 'ítems listados'}
                  </span>
                </div>
              </div>

              <DataTable 
                data={consumptionData}
                columns={columns}
                keyExtractor={(item: MaterialConsumption) => item.materialId}
                emptyMessage="No hay salidas de inventario registradas para este filtro."
                enableVirtualization={true}
                virtualHeight={500}
              />
            </div>
          </>
        )}

        {/* ESTADO CUANDO NO HAY COINCIDENCIAS */}
        {hasSearch && matchingMovements.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 text-2xl">
              <FiSearch />
            </div>
            <h4 className="text-base font-bold text-blue-950 mb-1">
              No se encontraron salidas ni consumos para "{searchTerm || selectedProjectFilter}"
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              Verifique el código FDH, número de solicitud o nombre de proyecto ingresado. Recuerde que este módulo analiza únicamente movimientos de Salida y Devolución.
            </p>
            <ActionButton
              onClick={() => {
                setSearchTerm('');
                setSelectedProjectFilter('');
                setSelectedMovementId(null);
              }}
              label="Ver sugerencias de proyectos"
              variant="secondary"
            />
          </div>
        )}

        {/* ESTADO INICIAL / SUGERENCIAS DE PROYECTOS */}
        {!hasSearch && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <FiSearch />
              </div>
              <h3 className="text-lg font-black text-blue-950 mb-2">
                Análisis de Consumo de Materiales por Proyecto
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto mb-6 font-medium">
                Escribe en el buscador superior un código FDH (por ejemplo <span className="font-mono font-bold text-blue-600">FDH0103</span>), número de solicitud (ej. <span className="font-mono font-bold text-blue-600">SOL-0167</span>) o haz clic en alguno de los proyectos frecuentes abajo.
              </p>

              {/* Proyectos Sugeridos con Salidas */}
              {availableProjects.length > 0 && (
                <div className="max-w-2xl mx-auto">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    Proyectos con Consumo Registrado Recientemente
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {availableProjects.slice(0, 8).map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSearchTerm(p.fdh || p.value);
                          setSelectedProjectFilter(p.value);
                        }}
                        className="px-3 py-2 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all flex items-center gap-2"
                      >
                        {p.fdh && (
                          <span className="font-mono font-black text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-100">
                            {p.fdh}
                          </span>
                        )}
                        <span className="truncate max-w-[200px]">{p.label}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({p.count} {p.count === 1 ? 'salida' : 'salidas'})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

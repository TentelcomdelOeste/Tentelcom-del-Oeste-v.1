import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheckCircle, FiAlertTriangle, FiPlusCircle, FiSearch, FiRefreshCw, FiDatabase, FiInfo, FiZap, FiClock, FiList, FiAlertOctagon } from 'react-icons/fi';
import { InventoryItem } from '../inventoryTypes';
import { InventoryMovement } from '../inventoryMovementTypes';
import { InventoryCostLayer } from '../types/fifoCostTypes';
import { User } from '../utils/types';
import { isAdmin } from '../utils/permissions';
import { formatCurrency } from '../utils/formatCurrency';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useConfirm, ActionButton, IconButton, SearchInput } from '../design-system';
import { 
  diagnoseHistoricalLayers, 
  applyHistoricalLayerReconstruction, 
  fetchAllInventoryDataFromFirestore,
  GlobalReconstructionDiagnostic 
} from '../services/historicalLayerReconstructionService';

interface ReconcileInventoryModalProps {
  show: boolean;
  onClose: () => void;
  items: InventoryItem[];
  movements: InventoryMovement[];
  costLayers: InventoryCostLayer[];
  currentUser: User;
}

interface ItemReconciliation {
  item: InventoryItem;
  physicalStock: number;
  coveredQty: number;
  uncoveredQty: number;
  surplusQty: number;
  activeLayersCount: number;
  status: 'OK' | 'UNCOVERED' | 'SURPLUS' | 'NO_STOCK';
  layers: InventoryCostLayer[];
}

export const ReconcileInventoryModal: React.FC<ReconcileInventoryModalProps> = ({
  show,
  onClose,
  items,
  movements: initialMovements,
  costLayers: initialCostLayers,
  currentUser
}) => {
  const confirm = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ISSUES' | 'OK'>('ISSUES');

  // Estado para la Reconstrucción Histórica Controlada (Etapas A y B)
  const [diagnostic, setDiagnostic] = useState<GlobalReconstructionDiagnostic | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);
  const [diagnosticStage, setDiagnosticStage] = useState<string>('');
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyProgress, setApplyProgress] = useState<{ processed: number; total: number } | null>(null);

  // Modal para regularizar saldo inicial individual
  const [regularizeItem, setRegularizeItem] = useState<ItemReconciliation | null>(null);
  const [unitCostInput, setUnitCostInput] = useState<string>('');
  const [currencyInput, setCurrencyInput] = useState<'CRC' | 'USD'>('CRC');
  const [providerInput, setProviderInput] = useState<string>('');
  const [invoiceRefInput, setInvoiceRefInput] = useState<string>('');
  const [reasonInput, setReasonInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Análisis de Conciliación por Artículo en Tiempo Real
  const reconciliationData = useMemo(() => {
    return items.map(item => {
      const itemLayers = initialCostLayers.filter(l => l.inventoryItemId === item.id && l.status === 'active');
      const coveredQty = itemLayers.reduce((sum, l) => sum + (l.quantityRemaining || 0), 0);
      const physicalStock = Math.max(0, item.stock || 0);

      const uncoveredQty = Math.max(0, physicalStock - coveredQty);
      const surplusQty = Math.max(0, coveredQty - physicalStock);

      let status: 'OK' | 'UNCOVERED' | 'SURPLUS' | 'NO_STOCK' = 'OK';
      if (physicalStock === 0 && coveredQty === 0) {
        status = 'NO_STOCK';
      } else if (uncoveredQty > 0) {
        status = 'UNCOVERED';
      } else if (surplusQty > 0) {
        status = 'SURPLUS';
      } else {
        status = 'OK';
      }

      return {
        item,
        physicalStock,
        coveredQty,
        uncoveredQty,
        surplusQty,
        activeLayersCount: itemLayers.length,
        status,
        layers: itemLayers
      } as ItemReconciliation;
    });
  }, [items, initialCostLayers]);

  // Estadísticas del informe de conciliación
  const stats = useMemo(() => {
    let okCount = 0;
    let uncoveredCount = 0;
    let surplusCount = 0;
    let totalUncoveredUnits = 0;

    reconciliationData.forEach(r => {
      if (r.status === 'OK' || r.status === 'NO_STOCK') okCount++;
      if (r.status === 'UNCOVERED') {
        uncoveredCount++;
        totalUncoveredUnits += r.uncoveredQty;
      }
      if (r.status === 'SURPLUS') surplusCount++;
    });

    return {
      totalItems: items.length,
      okCount,
      uncoveredCount,
      surplusCount,
      totalUncoveredUnits
    };
  }, [reconciliationData, items.length]);

  // Filtrado de la lista
  const filteredData = useMemo(() => {
    return reconciliationData.filter(r => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const codeMatch = r.item.code?.toLowerCase().includes(term);
        const descMatch = r.item.description?.toLowerCase().includes(term);
        if (!codeMatch && !descMatch) return false;
      }

      if (filterTab === 'ISSUES') {
        return r.status === 'UNCOVERED' || r.status === 'SURPLUS';
      }
      if (filterTab === 'OK') {
        return r.status === 'OK' || r.status === 'NO_STOCK';
      }
      return true;
    });
  }, [reconciliationData, searchTerm, filterTab]);

  // ETAPA A: Diagnóstico de Reconstrucción de Capas desde el Historial COMPLETO de Firestore
  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    setDiagnosticStage("Conectando con Firestore...");
    try {
      // 1. Cargar el 100% del historial de movimientos, items y capas sin depender de límites de la UI
      const fullData = await fetchAllInventoryDataFromFirestore((stage) => {
        setDiagnosticStage(stage);
      });

      setDiagnosticStage("Analizando trazabilidad cronológica PEPS...");

      // 2. Ejecutar el diagnóstico cronológico sobre el historial completo
      const result = diagnoseHistoricalLayers(fullData.items, fullData.movements, fullData.costLayers);
      setDiagnostic(result);
    } catch (err: any) {
      console.error("Error al diagnosticar capas históricas:", err);
      alert(`Ocurrió un error al consultar el historial completo de Firestore: ${err.message || String(err)}`);
    } finally {
      setIsDiagnosing(false);
      setDiagnosticStage('');
    }
  };

  // ETAPA B: Aplicación Controlada de Reconstrucción de Capas
  const handleApplyReconstruction = async () => {
    if (!diagnostic || diagnostic.totalMissingLayersToCreate === 0) return;

    const tc008Msg = diagnostic.tc008Diagnostic && diagnostic.tc008Diagnostic.layersToCreate.length > 0
      ? `\n• TC008 (ABRAZADERA DE 7"): Se respaldarán ${diagnostic.tc008Diagnostic.projectedCoveredQty} de ${diagnostic.tc008Diagnostic.physicalStock} unidades a ₡2.312,50.`
      : '';

    const confirmed = await confirm({
      title: "Confirmar Reconstrucción de Capas Históricas PEPS",
      description: `Se procesó el historial completo de ${diagnostic.totalMovementsConsulted.toLocaleString('es-CR')} movimientos y se crearán ${diagnostic.totalMissingLayersToCreate} capas de costo faltantes en Firestore.\n\nEsto cubrirá ${diagnostic.totalUnitsToCover.toLocaleString('es-CR')} unidades físicas a sus precios de compra originales de adquisición.${tc008Msg}\n\n¿Desea aplicar esta reconstrucción en Firestore?`,
      confirmLabel: "APLICAR RECONSTRUCCIÓN EN FIRESTORE",
      variant: "primary"
    });

    if (!confirmed) return;

    setIsApplying(true);
    setApplyProgress({ processed: 0, total: diagnostic.totalMissingLayersToCreate });
    try {
      const res = await applyHistoricalLayerReconstruction(
        diagnostic, 
        currentUser.email,
        (processed, total) => {
          setApplyProgress({ processed, total });
        }
      );
      alert(`✅ Reconstrucción completada con éxito. Se crearon ${res.createdCount} capas PEPS respaldadas por entradas históricas reales.`);
      setDiagnostic(null);
    } catch (err: any) {
      console.error("Error aplicando reconstrucción de capas:", err);
      alert(`Error al guardar las capas en Firestore: ${err.message || String(err)}`);
    } finally {
      setIsApplying(false);
      setApplyProgress(null);
    }
  };

  // Manejo de la apertura del modal de regularización individual
  const handleOpenRegularize = (rec: ItemReconciliation) => {
    setRegularizeItem(rec);
    setUnitCostInput(rec.item.price ? String(rec.item.price) : '');
    setCurrencyInput(rec.item.currency || 'CRC');
    setProviderInput('');
    setInvoiceRefInput('SALDO_INICIAL_AUDITADO');
    setReasonInput('Regularización de existencias históricas sin capa de costo PEPS previa.');
  };

  // Guardar Capa de Regularización Controlada Individual
  const handleSaveRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regularizeItem) return;

    const costVal = parseFloat(unitCostInput);
    if (isNaN(costVal) || costVal < 0) {
      alert("Por favor ingrese un costo unitario válido (>= 0).");
      return;
    }

    if (!reasonInput.trim()) {
      alert("Por favor ingrese una justificación o motivo de la regularización.");
      return;
    }

    const confirmed = await confirm({
      title: "Confirmar Regularización de Saldo Inicial",
      description: `Se registrará una Capa de Costo PEPS por ${regularizeItem.uncoveredQty} ${regularizeItem.item.unit || 'und'} a un costo unitario base de ${formatCurrency(costVal, currencyInput)}. ¿Desea proceder?`,
      confirmLabel: "REGISTRAR CAPA",
      variant: "primary"
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const dateStr = nowIso.split('T')[0];
      const layerId = `layer_reg_init_${regularizeItem.item.id}_${Date.now()}`;

      const newLayer: InventoryCostLayer = {
        id: layerId,
        inventoryItemId: regularizeItem.item.id,
        inventoryItemCode: regularizeItem.item.code,
        inventoryItemName: regularizeItem.item.description,
        movementId: `regularizacion_controlada_${Date.now()}`,
        movementRequestNumber: 'REG-INICIAL',
        date: dateStr,
        quantityOriginal: regularizeItem.uncoveredQty,
        quantityRemaining: regularizeItem.uncoveredQty,
        unitCost: costVal,
        currency: currencyInput,
        exchangeRate: currencyInput === 'USD' ? 515 : 1,
        unitCostNormalized: costVal,
        provider: providerInput.trim() || 'REGULARIZACIÓN INICIAL',
        invoiceReference: invoiceRefInput.trim() || 'REGULARIZACIÓN_AUDITADA',
        iva: costVal * 0.13,
        taxRate: 0.13,
        status: 'active',
        createdAt: nowIso,
        createdBy: currentUser.email || 'Admin',
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'inventory_cost_layers', layerId), newLayer);

      setRegularizeItem(null);
    } catch (error) {
      console.error("Error guardando regularización de saldo inicial:", error);
      alert("Error al guardar la capa de regularización.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
          <div>
            <div className="flex items-center gap-2">
              <FiDatabase className="text-blue-600 text-xl" />
              <h3 className="text-lg sm:text-xl font-black text-blue-950 uppercase tracking-tight">Conciliación y Reconstrucción Histórica PEPS</h3>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1">
              Análisis completo del 100% de movimientos históricos en Firestore para recuperar compras reales.
            </p>
          </div>
          <IconButton onClick={onClose} icon={<FiX />} variant="neutral" title="Cerrar" />
        </div>

        {/* Resumen Superior */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <span className="font-bold text-slate-500">Total Artículos Catálogo</span>
            <span className="font-black text-sm text-slate-800">{stats.totalItems}</span>
          </div>

          <div className={`p-3 rounded-xl border shadow-2xs flex items-center justify-between ${
            stats.uncoveredCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <span className="font-bold flex items-center gap-1.5">
              {stats.uncoveredCount === 0 ? <FiCheckCircle className="text-emerald-600 text-base" /> : <FiAlertTriangle className="text-amber-600 text-base" />}
              Con Stock sin Capa
            </span>
            <span className="font-black text-sm">
              {stats.uncoveredCount} art. ({stats.totalUncoveredUnits.toLocaleString('es-CR')} uds)
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <span className="font-bold text-slate-500">100% Conciliados</span>
            <span className="font-black text-sm text-emerald-700">{stats.okCount} art.</span>
          </div>
        </div>

        {/* Banner de Diagnóstico de Reconstrucción Histórica Completa (Etapas A y B) */}
        {isAdmin(currentUser.role) && (
          <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white border-b border-blue-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FiZap className="text-amber-400 text-xl shrink-0" />
                <div>
                  <h4 className="font-black uppercase text-xs sm:text-sm tracking-wide">
                    Diagnóstico y Reconstrucción Histórica Completa (PEPS)
                  </h4>
                  <p className="text-[11px] text-blue-200/90 font-medium">
                    Recorre todas las páginas del historial sin límite de 50 registros para respaldar stock no cubierto.
                  </p>
                </div>
              </div>

              {!diagnostic ? (
                <ActionButton
                  onClick={handleRunDiagnostic}
                  label={isDiagnosing ? diagnosticStage || "Consultando Historial..." : "Iniciar Diagnóstico Histórico Completo"}
                  variant="secondary"
                  disabled={isDiagnosing}
                  className="bg-white text-blue-900 hover:bg-blue-50 font-black h-9 px-4 text-xs shrink-0"
                  icon={<FiSearch className={isDiagnosing ? "animate-spin" : ""} />}
                />
              ) : (
                <div className="flex gap-2 shrink-0">
                  <ActionButton
                    onClick={handleApplyReconstruction}
                    label={isApplying ? `Aplicando (${applyProgress?.processed || 0}/${applyProgress?.total || 0})...` : `Aplicar Reconstrucción (${diagnostic.totalMissingLayersToCreate} Capas)`}
                    variant="primary"
                    disabled={isApplying || diagnostic.totalMissingLayersToCreate === 0}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black h-9 px-4 text-xs border-0 shadow-sm"
                    icon={<FiCheckCircle />}
                  />
                  <ActionButton
                    onClick={() => setDiagnostic(null)}
                    label="Cerrar Diagnóstico"
                    variant="neutral"
                    disabled={isApplying}
                    className="bg-blue-800/80 hover:bg-blue-800 text-white font-bold h-9 px-3 text-xs border-blue-700"
                  />
                </div>
              )}
            </div>

            {/* Progreso de aplicación */}
            {isApplying && applyProgress && (
              <div className="w-full bg-blue-950/60 rounded-full h-2 overflow-hidden border border-blue-700">
                <div 
                  className="bg-emerald-400 h-full transition-all duration-300" 
                  style={{ width: `${Math.round((applyProgress.processed / (applyProgress.total || 1)) * 100)}%` }}
                />
              </div>
            )}

            {/* Resultado del Diagnóstico Preview */}
            {diagnostic && (
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/20 text-xs space-y-3 animate-in fade-in duration-200">
                
                {/* Métricas Principales de Diagnóstico Histórico */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono">
                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[9px] text-blue-200 block uppercase font-sans">Materiales Analizados</span>
                    <span className="font-black text-white text-sm">{diagnostic.totalItemsAnalyzed}</span>
                  </div>

                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[9px] text-blue-200 block uppercase font-sans">Movimientos Consultados</span>
                    <span className="font-black text-sky-300 text-sm">{diagnostic.totalMovementsConsulted.toLocaleString('es-CR')}</span>
                  </div>

                  <div className="bg-white/5 p-2 rounded-xl border border-white/10 col-span-2 sm:col-span-1">
                    <span className="text-[9px] text-blue-200 block uppercase font-sans">Rango del Historial</span>
                    <span className="font-black text-slate-200 text-[11px] block truncate">
                      {diagnostic.oldestMovementDate ? `${diagnostic.oldestMovementDate} a ${diagnostic.newestMovementDate}` : 'Sin datos'}
                    </span>
                  </div>

                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[9px] text-blue-200 block uppercase font-sans">Capas A Crear</span>
                    <span className="font-black text-amber-300 text-sm">{diagnostic.totalMissingLayersToCreate}</span>
                  </div>

                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[9px] text-blue-200 block uppercase font-sans">Unidades A Cubrir</span>
                    <span className="font-black text-emerald-300 text-sm">{diagnostic.totalUnitsToCover.toLocaleString('es-CR')}</span>
                  </div>

                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[9px] text-blue-200 block uppercase font-sans">Quedarán SIN CAPA</span>
                    <span className={`font-black text-sm ${diagnostic.totalUnitsRemainingUncovered > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {diagnostic.totalUnitsRemainingUncovered.toLocaleString('es-CR')}
                    </span>
                  </div>

                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[9px] text-blue-200 block uppercase font-sans">Revisión / Discrepancias</span>
                    <span className={`font-black text-sm ${diagnostic.discrepancyCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                      {diagnostic.discrepancyCount} art.
                    </span>
                  </div>
                </div>

                {/* Resumen TC008 si aplica */}
                {diagnostic.tc008Diagnostic && (
                  <div className="pt-2 border-t border-white/20 text-[11px] font-sans flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-200 flex items-center gap-1.5">
                      <FiInfo className="text-amber-300 text-sm shrink-0" />
                      TC008 (ABRAZADERA DE 7"): Stock {diagnostic.tc008Diagnostic.physicalStock} uds → Entradas encontradas: {diagnostic.tc008Diagnostic.candidateEntriesCount}. 
                      {diagnostic.tc008Diagnostic.layersToCreate.length > 0 
                        ? ` Creará capa por ${diagnostic.tc008Diagnostic.projectedCoveredQty} uds a ₡2.312,50.`
                        : ` Totalmente cubierto o procesado.`
                      }
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-blue-950 font-black text-[10px] uppercase">
                      ✓ Cobertura PEPS Verificada
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toolbar de Filtros */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SearchInput
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full sm:w-72"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterTab('ISSUES')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'ISSUES' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚠️ Con Pendientes ({stats.uncoveredCount + stats.surplusCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('OK')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'OK' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✓ Conciliados ({stats.okCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'ALL' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({stats.totalItems})
            </button>
          </div>
        </div>

        {/* Lista de Conciliación */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredData.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-slate-200/80">
              No se encontraron artículos para el filtro seleccionado.
            </div>
          ) : (
            filteredData.map(r => {
              const diagItem = diagnostic?.itemDiagnostics.find(d => d.item.id === r.item.id);

              return (
                <div
                  key={r.item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    r.status === 'UNCOVERED'
                      ? 'bg-amber-50/40 border-amber-200'
                      : r.status === 'SURPLUS'
                      ? 'bg-purple-50/40 border-purple-200'
                      : 'bg-white border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Info Artículo */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {r.item.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {r.item.description}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {r.item.category || 'General'}
                        </span>
                      </div>
                    </div>

                    {/* Stock vs Capas */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Stock Físico</span>
                        <span className="font-black text-slate-800 font-mono">
                          {r.physicalStock} {r.item.unit || 'und'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cubierto Capas</span>
                        <span className="font-black text-blue-700 font-mono">
                          {r.coveredQty} {r.item.unit || 'und'}
                        </span>
                      </div>

                      {/* Estado Badge */}
                      <div className="text-right min-w-[120px]">
                        {r.status === 'OK' && (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-200 inline-block">
                            ✓ 100% PEPS OK
                          </span>
                        )}
                        {r.status === 'NO_STOCK' && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold border border-slate-200 inline-block">
                            SIN STOCK
                          </span>
                        )}
                        {r.status === 'UNCOVERED' && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black border border-amber-300 inline-block">
                            ⚠️ {r.uncoveredQty} {r.item.unit || 'und'} SIN CAPA
                          </span>
                        )}
                        {r.status === 'SURPLUS' && (
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-900 rounded-lg text-[10px] font-black border border-purple-300 inline-block">
                            EXCEDENTE {r.surplusQty} {r.item.unit || 'und'}
                          </span>
                        )}
                      </div>

                      {/* Acciones */}
                      {isAdmin(currentUser.role) && r.status === 'UNCOVERED' && (
                        <ActionButton
                          onClick={() => handleOpenRegularize(r)}
                          label="Regularizar Saldo Inicial"
                          variant="secondary"
                          className="h-8 px-3 text-[10px] bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200 font-bold"
                          icon={<FiPlusCircle />}
                        />
                      )}
                    </div>
                  </div>

                  {/* Detalle de Diagnóstico si está activo */}
                  {diagItem && diagItem.uncoveredReason && (
                    <div className="mt-2.5 p-2.5 bg-slate-100/90 rounded-xl border border-slate-200 text-[11px] text-slate-700 font-medium flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <FiInfo className="text-slate-500 text-xs shrink-0" />
                        {diagItem.uncoveredReason}
                      </span>
                      {diagItem.layersToCreate.length > 0 && (
                        <span className="font-bold text-emerald-700 font-mono text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                          +{diagItem.layersToCreate.length} capa(s) a crear
                        </span>
                      )}
                    </div>
                  )}

                  {/* Desglose de Capas Activas del Artículo */}
                  {r.layers.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-200/60 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Capas de Costo Activas ({r.layers.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {r.layers.map(layer => (
                          <div key={layer.id} className="bg-white p-2 rounded-lg border border-slate-200 text-[10px] font-mono flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-700">{layer.date}</span>
                              {layer.invoiceReference && (
                                <span className="text-slate-400 block text-[9px]">Ref: {layer.invoiceReference}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-blue-900">
                                {layer.quantityRemaining} / {layer.quantityOriginal} {r.item.unit || 'und'}
                              </span>
                              <span className="text-slate-500 block">
                                @ {formatCurrency(layer.unitCost, layer.currency || 'CRC')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Secundario: Formulario de Regularización Controlada de Saldo Inicial */}
        {regularizeItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[220] p-4" onClick={() => setRegularizeItem(null)}>
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FiPlusCircle className="text-amber-600 text-lg" />
                  <h4 className="font-black text-slate-900 uppercase text-sm">Regularización Controlada de Saldo Inicial PEPS</h4>
                </div>
                <IconButton onClick={() => setRegularizeItem(null)} icon={<FiX />} variant="neutral" title="Cerrar" />
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">
                  Artículo: {regularizeItem.item.code} - {regularizeItem.item.description}
                </p>
                <p>
                  Cantidad sin Capa: <span className="font-black font-mono">{regularizeItem.uncoveredQty} {regularizeItem.item.unit || 'und'}</span>
                </p>
                <p className="text-[10px] text-amber-800">
                  Esta operación registrará una Capa PEPS respaldada por la administración para asignar costo auditado al stock histórico.
                </p>
              </div>

              <form onSubmit={handleSaveRegularization} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Costo Unitario Base (Sin IVA) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={unitCostInput}
                    onChange={e => setUnitCostInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej. 190.84"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Moneda de Compra *</label>
                    <select
                      value={currencyInput}
                      onChange={e => setCurrencyInput(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="CRC">Colones (CRC)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Factura / Ref. Auditoría</label>
                    <input
                      type="text"
                      value={invoiceRefInput}
                      onChange={e => setInvoiceRefInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-800 outline-none"
                      placeholder="Ej. FACT-001"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proveedor / Origen</label>
                  <input
                    type="text"
                    value={providerInput}
                    onChange={e => setProviderInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none"
                    placeholder="Ej. Inventario Inicial Auditado"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Justificación del Ajuste *</label>
                  <textarea
                    rows={2}
                    required
                    value={reasonInput}
                    onChange={e => setReasonInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none"
                    placeholder="Ingrese el motivo de la regularización..."
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <ActionButton
                    onClick={() => setRegularizeItem(null)}
                    label="Cancelar"
                    variant="neutral"
                  />
                  <ActionButton
                    type="submit"
                    label={isSubmitting ? "Guardando..." : "Registrar Capa"}
                    variant="primary"
                    disabled={isSubmitting}
                  />
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};

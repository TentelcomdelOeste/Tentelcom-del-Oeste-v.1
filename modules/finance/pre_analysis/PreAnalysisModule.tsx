import React, { useState, useMemo, useEffect } from 'react';
import { useConfirm } from '../../../design-system/modals/ConfirmContext';
import { usePreAnalysis } from '../../../hooks/usePreAnalysis';
import { useClients } from '../../../hooks/useClients';
import { useFinance } from '../../../hooks/useFinance';
import { User } from '../../../utils/types';
import { PreAnalysisCostItem, ProjectRiskLevel } from '../../../types/preAnalysis.types';
import { ModulePage } from '../../../components/ui/ModulePage';
import { Toolbar, DataTable, TableColumn, ActionButton, IconButton, ACTION_ICONS, SearchInput } from '../../../design-system';
import { formatCurrency } from '../../../utils/formatCurrency';
import { ClientDirectoryModal } from '../../quotes/ClientDirectoryModal';
import { FiArrowLeft, FiSearch, FiUsers, FiBriefcase, FiList, FiSliders, FiPlusCircle, FiMonitor, FiCheck, FiEdit, FiTrash2 } from "react-icons/fi";

interface Props {
  currentUser: User;
}

// Extensión local del tipo para soportar edición en sesión
interface ExtendedCostItem extends PreAnalysisCostItem {
    quantity?: number;
    metadata?: {
        crewIds?: string[];
        days?: number;
        viaticosConfig?: Record<string, number>;
        crewCount?: number;
    }
}

export const PreAnalysisModule: React.FC<Props> = ({ currentUser }) => {
  const { simulations, isLoading, savePreAnalysis, deletePreAnalysis, hasMore, loadMore, loadingMore } = usePreAnalysis(currentUser);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSimulation, setEditingSimulation] = useState<any | null>(null);

  const filteredData = simulations.filter(s => 
    s.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (simulation: any) => {
    setEditingSimulation(simulation);
    setView('create');
  };

  const handleNew = () => {
    setEditingSimulation(null);
    setView('create');
  };

  const handleSaveSimulation = async (data: any) => {
    await savePreAnalysis(data, editingSimulation?.id);
    setEditingSimulation(null);
    setView('list');
  };

  const columns: TableColumn<any>[] = [
    {
      header: "Proyecto / Cliente",
      render: (s) => (
        <div>
          <p className="font-black text-blue-900 text-xs uppercase">{s.projectName}</p>
          <p className="text-[10px] font-bold text-slate-400">{s.client}</p>
        </div>
      )
    },
    {
      header: "Costo Total Est.",
      align: "right",
      render: (s) => <span className="font-mono font-bold text-slate-600">{formatCurrency(s.totalEstimatedCosts, s.currency)}</span>
    },
    {
      header: "Margen",
      align: "center",
      render: (s) => (
        <span className={`px-2 py-1 rounded-full text-[9px] font-black border ${s.projectedMargin >= 20 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
          {(Number(s.projectedMargin) || 0).toFixed(1)}%
        </span>
      )
    },
    {
      header: "Acciones",
      align: "center",
      render: (s) => (
        <div className="flex justify-center gap-2">
          <IconButton icon={<ACTION_ICONS.edit />} onClick={() => handleEdit(s)} variant="primary" title="Editar Evaluación" />
          <IconButton icon={<ACTION_ICONS.delete />} onClick={() => deletePreAnalysis(s.id)} variant="danger" title="Eliminar" />
        </div>
      )
    }
  ];

  if (view === 'create') {
    return (
      <div className="w-full animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="mb-6">
          <button 
            type="button"
            onClick={() => { setView('list'); setEditingSimulation(null); }}
            className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors flex items-center gap-2"
          >
            <FiArrowLeft  /> Volver a Evaluación
          </button>
        </div>
        <PreAnalysisStrategicView 
          currentUser={currentUser}
          initialData={editingSimulation}
          onClose={() => { setView('list'); setEditingSimulation(null); }} 
          onSubmit={handleSaveSimulation} 
        />
      </div>
    );
  }

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage title="Evaluación Estratégica" subtitle="Simulación de viabilidad técnica y financiera de proyectos.">
        <Toolbar
          left={<SearchInput placeholder="Buscar evaluación..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />}
          right={<ActionButton label="Nueva Evaluación" onClick={handleNew} />}
        />
        <DataTable data={filteredData} columns={columns} keyExtractor={s => s.id} isLoading={isLoading} emptyMessage="No hay evaluaciones registradas." hasMore={hasMore} onLoadMore={loadMore} isLoadingMore={loadingMore} enableVirtualization={true} virtualHeight={600} />
      </ModulePage>
    </div>
  );
};

/**
 * VISTA ESTRATÉGICA PRINCIPAL
 */
const PreAnalysisStrategicView: React.FC<{ 
    currentUser: User, 
    initialData?: any,
    onClose: () => void, 
    onSubmit: (data: any) => Promise<void> 
}> = ({ currentUser, initialData, onClose, onSubmit }) => {
  const { 
    savedClients, 
    deactivateClient,
    loadMore: loadMoreClients,
    hasMore: hasMoreClients,
    loadingMore: loadingMoreClients
  } = useClients(currentUser);
  const { employees } = useFinance(currentUser);
  
  // Estados de Configuración
  const [projectName, setProjectName] = useState('');
  const [client, setClient] = useState('');
  const [contact, setContact] = useState('');
  const [budget, setBudget] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'CRC'>('USD');
  const [duration, setDuration] = useState<number>(0);
  const [contingency, setContingency] = useState<number>(0);
  const [targetMargin, setTargetMargin] = useState<number>(30);
  
  // Estados de Costos e Ítems
  const [costItems, setCostItems] = useState<ExtendedCostItem[]>([]);
  
  // Estados de Cuadrilla (Workforce)
  const [showCrewBuilder, setShowCrewBuilder] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<Record<string, boolean>>({});
  const [crewDays, setCrewDays] = useState<number>(0);
  const [crewSearch, setCrewSearch] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Estados de Viáticos
  const [showViaticosBuilder, setShowViaticosBuilder] = useState(false);
  const [viaticosConfig, setViaticosConfig] = useState<Record<string, number>>({
    'Alimentación': 0,
    'Hospedaje': 0,
    'Transporte': 0,
    'Combustible': 0,
    'Otros': 0
  });

  // Estado de Sensibilidad (Simulación)
  const [sensitivity, setSensitivity] = useState({ materials: 0, labor: 0, exchange: 0 });
  
  // Estado de Riesgo
  const [riskFactors, setRiskFactors] = useState({ complexity: 1, financial: 1, timeline: 1 });

  const [showClientModal, setShowClientModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'costs' | 'sensitivity' | 'cashflow'>('costs');
  const [applyTax, setApplyTax] = useState(true);
  const confirm = useConfirm();

  // --- HIDRATACIÓN DE DATOS SI ES EDICIÓN DE EVALUACIÓN ---
  useEffect(() => {
    if (initialData) {
        setProjectName(initialData.projectName || '');
        setClient(initialData.client || '');
        setContact(initialData.contact || '');
        setBudget(initialData.estimatedBudget?.toString() || '');
        setCurrency(initialData.currency || 'USD');
        setDuration(initialData.durationMonths || 0);
        setContingency(initialData.contingencyPercent || 0);
        setTargetMargin(initialData.targetMargin || 30);
        setCostItems(initialData.costItems || []);
        
        if (initialData.sensitivity) {
            setSensitivity({
                materials: initialData.sensitivity.materials || 0,
                labor: initialData.sensitivity.labor || 0,
                exchange: initialData.sensitivity.exchangeRate || 0
            });
        }
        
        if (initialData.riskFactors) {
            setRiskFactors(initialData.riskFactors);
        }
    }
  }, [initialData]);

  // Inicializar días de cuadrilla cuando cambia la duración del proyecto
  useEffect(() => {
    if (duration > 0 && crewDays === 0) setCrewDays(duration);
  }, [duration, crewDays]);

  // MOTOR DE CÁLCULO ESTRATÉGICO
  const financials = useMemo(() => {
    const budgetNum = parseFloat(budget) || 0;
    
        const costsBase = costItems.reduce((acc: { direct: number; indirect: number }, item: ExtendedCostItem) => {
        const quantity = Number(item.quantity) || 1;
        let val: number = (Number(item.amount) || 0) * quantity;

        if (item.type === 'Directo') {
            if (item.category === 'Materiales') val = val * (1 + (Number(sensitivity.materials) || 0) / 100);
            if (item.category === 'Mano de Obra') val = val * (1 + (Number(sensitivity.labor) || 0) / 100);
        }
        if (currency === 'USD') val = val * (1 + (Number(sensitivity.exchange) || 0) / 100);
        
        if (item.type === 'Directo') acc.direct += val;
        else acc.indirect += val;
        return acc;
    }, { direct: 0, indirect: 0 });

    const subtotalCosts = costsBase.direct + costsBase.indirect;
    const contingencyAmount = subtotalCosts * (contingency / 100);
    const totalCosts = subtotalCosts + contingencyAmount;

    let utility = 0;
    let margin = 0;
    let suggestedPrice = 0;
    let isProjected = false;

    if (budgetNum > 0) {
        utility = budgetNum - totalCosts;
        margin = (utility / budgetNum) * 100;
    } else {
        isProjected = true;
        margin = targetMargin;
        suggestedPrice = totalCosts / (1 - targetMargin / 100);
        utility = suggestedPrice - totalCosts;
    }

    const breakEven = totalCosts;
    const totalRiskScore = (riskFactors.complexity || 1) + (riskFactors.financial || 1) + (riskFactors.timeline || 1);
    let riskLevel: ProjectRiskLevel = 'Bajo';
    if (totalRiskScore > 4) riskLevel = 'Medio';
    if (totalRiskScore > 7) riskLevel = 'Alto';

    return { 
        budgetNum, direct: costsBase.direct, indirect: costsBase.indirect, 
        contingencyAmount, totalCosts, utility, margin, breakEven, 
        suggestedPrice, isProjected, riskLevel 
    };
  }, [budget, costItems, contingency, targetMargin, sensitivity, currency, riskFactors]);

  // CÁLCULO DE CUADRILLA
  const crewFinancials = useMemo(() => {
      let dailyCost = 0;
      let count = 0;
      Object.entries(selectedCrew).forEach(([id, isSelected]) => {
          if (isSelected) {
              const emp = employees.find(e => e.id === id);
              if (emp) {
                  const dayRate = (Number(emp.baseSalary) || 0) / 30;
                  dailyCost += dayRate;
                  count++;
              }
          }
      });
      return { dailyCost, totalCost: dailyCost * (Number(crewDays) || 0), count };
  }, [selectedCrew, crewDays, employees]);

  // CÁLCULO DE VIÁTICOS (HIDRATACIÓN DINÁMICA)
  const viaticosFinancials = useMemo(() => {
      const itemBeingEdited = costItems.find(i => i.id === editingItemId);
      
      const crewItem = costItems.find(item => item.category === 'Mano de Obra');
      const crewCountFromItem = crewItem?.metadata?.crewIds?.length || 0;

      const workforceCount = crewFinancials.count || crewCountFromItem || itemBeingEdited?.metadata?.crewCount || 0;
      const days = Number(crewDays) || itemBeingEdited?.metadata?.days || Number(duration) || 0;
      
      let dailyPerPerson = 0;
      let dailyPerTeam = 0;

      Object.entries(viaticosConfig).forEach(([rubro, amount]) => {
          const val = Number(amount) || 0;
          if (rubro === 'Combustible' || rubro === 'Hospedaje') {
              dailyPerTeam += val;
          } else {
              dailyPerPerson += val;
          }
      });

      const totalDailyCost = (dailyPerPerson * workforceCount) + dailyPerTeam;

      return {
          dailyCost: totalDailyCost,
          totalCost: totalDailyCost * days,
          crewCount: workforceCount,
          days
      };
  }, [viaticosConfig, crewFinancials.count, crewDays, duration, editingItemId, costItems]);

  const handleToggleCrewMember = (id: string) => {
      setSelectedCrew(prev => {
          const next = { ...prev };
          if (next[id]) delete next[id];
          else next[id] = true;
          return next;
      });
  };

  const insertCrewToCosts = () => {
      if (crewFinancials.totalCost <= 0) return;
      
      const crewItem: ExtendedCostItem = {
          id: editingItemId || `crew-${Date.now()}`,
          type: 'Directo',
          category: 'Mano de Obra',
          description: `Cuadrilla (${crewFinancials.count} pers. - ${crewDays} días)`,
          amount: crewFinancials.totalCost,
          metadata: {
              crewIds: Object.keys(selectedCrew),
              days: crewDays
          }
      };

      if (editingItemId) {
          setCostItems(costItems.map(item => item.id === editingItemId ? crewItem : item));
      } else {
          setCostItems([...costItems, crewItem]);
      }
      closeCrewBuilder(true);
  };

  const closeCrewBuilder = (reset: boolean) => {
      setShowCrewBuilder(false);
      if (reset) {
          setSelectedCrew({});
          setEditingItemId(null);
          setCrewSearch('');
      }
  };

  // --- HANDLER CRÍTICO: EDICIÓN DE ITEMS ---
  const handleEditItem = (item: ExtendedCostItem) => {
      setEditingItemId(item.id);
      
      if (item.category === 'Mano de Obra' && item.metadata) {
          const initialCrew: Record<string, boolean> = {};
          item.metadata.crewIds?.forEach(id => initialCrew[id] = true);
          setSelectedCrew(initialCrew);
          setCrewDays(item.metadata.days || 0);
          setShowCrewBuilder(true);
          setShowViaticosBuilder(false);
      } 
      else if (item.category === 'Viáticos') {
          // HIDRATACIÓN OBLIGATORIA DE VIÁTICOS
          if (item.metadata?.viaticosConfig) {
              setViaticosConfig({ ...item.metadata.viaticosConfig }); // Copia profunda de rubros
          }
          setCrewDays(item.metadata?.days || duration || 0);
          setShowViaticosBuilder(true); // REAPERTURA DEL PANEL
          setShowCrewBuilder(false);
      }
  };

  const handleUpdateManualItem = (id: string, field: 'description' | 'amount' | 'quantity', value: string | number) => {
    setCostItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleAddManualLine = () => {
        const newItem: ExtendedCostItem = {
      id: `manual-${Date.now()}`,
      type: 'Directo',
      category: 'Manual',
      description: '',
      amount: 0,
      quantity: 1,
    };
    setCostItems(prev => [...prev, newItem]);
  };

  const insertViaticosToCosts = () => {
      if (viaticosFinancials.totalCost <= 0) return;

      const viaticoItem: ExtendedCostItem = {
          id: editingItemId || `viaticos-${Date.now()}`,
          type: 'Directo',
          category: 'Viáticos',
          description: `Viáticos Estructurados (${viaticosFinancials.crewCount} pers. - ${viaticosFinancials.days} días)`,
          amount: viaticosFinancials.totalCost,
          metadata: {
              viaticosConfig: { ...viaticosConfig },
              days: viaticosFinancials.days,
              crewCount: viaticosFinancials.crewCount
          }
      };

      if (editingItemId) {
          setCostItems(costItems.map(item => item.id === editingItemId ? viaticoItem : item));
      } else {
          setCostItems([...costItems, viaticoItem]);
      }
      
      // RESET TRAS GUARDAR
      setShowViaticosBuilder(false);
      setEditingItemId(null);
      setViaticosConfig({
          'Alimentación': 0,
          'Hospedaje': 0,
          'Transporte': 0,
          'Combustible': 0,
          'Otros': 0
      });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen pb-20">
      
      {/* SECCIÓN IZQUIERDA */}
      <div className="flex-1 space-y-8">
        
        {/* Bloque 1: Escenario */}
        <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200">
          <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest border-b pb-3 mb-6">Configuración del Escenario</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Proyecto</label>
                <input value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-blue-100" placeholder="Nombre de la evaluación..." />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cliente</label>
                <div className="flex gap-2">
                    <input value={client} onChange={e => setClient(e.target.value)} className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold" />
                    <button type="button" onClick={() => setShowClientModal(true)} className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 transition-all active:scale-95"><FiSearch  /></button>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nombre del Contacto</label>
                <input value={contact} onChange={e => setContact(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold" placeholder="Nombre del contacto..." />
              </div>
            </div>
            <div className="space-y-4">
               <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Presupuesto Cliente</label>
                    <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="w-full p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 font-black text-sm" placeholder="0.00" />
                  </div>
                  <div className="w-24">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Moneda</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold">
                        <option value="USD">USD</option>
                        <option value="CRC">CRC</option>
                    </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Duración (Meses)</label>
                    <input type="number" value={duration || ''} onChange={e => setDuration(Number(e.target.value))} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold" placeholder="Ej: 15" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Contingencia (%)</label>
                    <input type="number" value={contingency || ''} onChange={e => setContingency(Number(e.target.value))} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold" placeholder="Ej: 5" />
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-2">
            <button type="button" onClick={() => setActiveTab('costs')} className={`px-6 py-3 rounded-t-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'costs' ? 'bg-white border-x border-t border-slate-200 text-blue-900' : 'text-slate-400 hover:text-slate-600'}`}>1. Estructura de Costos</button>
        </div>

        <div className="bg-white p-8 rounded-b-[32px] rounded-tr-[32px] shadow-sm border border-slate-200 min-h-[400px]">
            {activeTab === 'costs' && (
                <div className="animate-in fade-in duration-300 space-y-6">
                    
                    {/* Constructores */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                                    <FiUsers className="text-sm"  />
                                </div>
                                <div>
                                    <h5 className="text-[9px] font-black text-blue-900 uppercase tracking-widest">Mano de Obra</h5>
                                    <p className="text-[10px] font-bold text-blue-600/70">Costo por personal real.</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => { setShowCrewBuilder(!showCrewBuilder); setShowViaticosBuilder(false); if(showCrewBuilder) closeCrewBuilder(true); }}
                                className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all shadow-md ${showCrewBuilder ? 'bg-white text-slate-400 border border-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                                {showCrewBuilder ? 'Cerrar' : 'Construir'}
                            </button>
                        </div>

                        <div className="flex justify-between items-center bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <FiBriefcase className="text-sm"  />
                                </div>
                                <div>
                                    <h5 className="text-[9px] font-black text-emerald-900 uppercase tracking-widest">Viáticos Proyectados</h5>
                                    <p className="text-[10px] font-bold text-emerald-600/70">Cálculo estructurado.</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => { setShowViaticosBuilder(!showViaticosBuilder); setShowCrewBuilder(false); if(showViaticosBuilder) { setEditingItemId(null); } }}
                                className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all shadow-md ${showViaticosBuilder ? 'bg-white text-slate-400 border border-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                            >
                                {showViaticosBuilder ? 'Cerrar' : 'Construir'}
                            </button>
                        </div>
                    </div>

                    {/* Constructor de Cuadrilla */}
                    {showCrewBuilder && (
                        <div className="animate-in slide-in-from-top-2 duration-300 bg-slate-50 border border-slate-200 rounded-[32px] p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between w-full">
                                        <span><FiList className="mr-2"  /> Selección de Personal Activo</span>
                                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[8px] font-black tracking-tighter">Colaboradores asignados: {crewFinancials.count}</span>
                                    </h6>
                                    <div className="relative">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"  />
                                        <input type="text" placeholder="Filtrar por nombre o puesto..." value={crewSearch} onChange={(e) => setCrewSearch(e.target.value)} className="w-full pl-8 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300" />
                                    </div>
                                    <div className="max-h-64 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                        {employees.filter(e => e.isActive && !e.isArchived).filter(e => { const term = crewSearch.toLowerCase(); return e.name.toLowerCase().includes(term) || e.position.toLowerCase().includes(term); }).map(emp => (
                                            <div key={emp.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedCrew[emp.id] ? 'bg-white border-blue-200 shadow-sm' : 'bg-transparent border-slate-200 opacity-60 hover:opacity-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" checked={!!selectedCrew[emp.id]} onChange={() => handleToggleCrewMember(emp.id)} className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
                                                    <div>
                                                        <p className="text-xs font-black text-blue-950 leading-none">{emp.name}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{emp.position}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-slate-600">{formatCurrency(emp.baseSalary)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FiSliders  /> Configuración y Resultados</h6>
                                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Días de Asignación</label>
                                            <input type="number" value={crewDays || ''} onChange={e => setCrewDays(Number(e.target.value))} className="w-20 p-2 rounded-lg bg-slate-50 border border-slate-200 text-center font-black text-xs" />
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 space-y-2">
                                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-tight"><span>Costo Diario Cuadrilla:</span><span className="text-slate-700">{formatCurrency(crewFinancials.dailyCost)}</span></div>
                                            <div className="flex justify-between items-end"><span className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1">Total Proyectado:</span><span className="text-2xl font-black text-blue-600 tracking-tighter">{formatCurrency(crewFinancials.totalCost)}</span></div>
                                        </div>
                                    </div>
                                    <button type="button" onClick={insertCrewToCosts} disabled={crewFinancials.totalCost <= 0} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:bg-slate-200 disabled:shadow-none">
                                        <FiPlusCircle className="mr-2"  /> {editingItemId ? 'Actualizar Cuadrilla' : 'Insertar en estructura de costos'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Constructor de Viáticos */}
                    {showViaticosBuilder && (
                        <div className="animate-in slide-in-from-top-2 duration-300 bg-emerald-50/30 border border-emerald-100 rounded-[32px] p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h6 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2"><FiList  /> Definición de Rubros Diarios</h6>
                                    <div className="space-y-3">
                                        {Object.keys(viaticosConfig).map(rubro => (
                                            <div key={rubro} className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100">
                                                <span className="text-[10px] font-black text-slate-600 uppercase">{rubro}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400">{(rubro === 'Combustible' || rubro === 'Hospedaje') ? '/día' : '/pers/día'}</span>
                                                    <input 
                                                        type="number" 
                                                        value={viaticosConfig[rubro] || ''} 
                                                        onChange={e => setViaticosConfig({...viaticosConfig, [rubro]: Number(e.target.value)})}
                                                        className="w-24 p-1.5 rounded bg-emerald-50 border border-emerald-100 text-right font-black text-xs outline-none"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h6 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2"><FiMonitor  /> Proyección Consolidada</h6>
                                    <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Colaboradores</p>
                                                <p className="text-lg font-black text-slate-700">{viaticosFinancials.crewCount}</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Días Totales</p>
                                                <p className="text-lg font-black text-slate-700">{viaticosFinancials.days}</p>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-emerald-50 space-y-2">
                                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-tight">
                                                <span>Costo Diario Viáticos:</span>
                                                <span className="text-slate-700 font-mono">{formatCurrency(viaticosFinancials.dailyCost)}</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-1">Total Viáticos:</span>
                                                <span className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(viaticosFinancials.totalCost)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={insertViaticosToCosts}
                                        disabled={viaticosFinancials.totalCost <= 0}
                                        className="w-full py-4 bg-emerald-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-800 transition-all active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
                                    >
                                        <FiCheck className="mr-2"  /> {editingItemId ? 'Actualizar Viáticos' : 'Insertar Viáticos en Escenario'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Costos */}
                                        <table className="w-full text-left">
                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                            <tr>
                                <th className="pb-3 w-[10%]">Categoría</th>
                                <th className="pb-3 w-[62%]">Descripción</th>
                                <th className="pb-3 text-center w-[6%]">Cantidad</th>
                                <th className="pb-3 text-right w-[9%]">Monto Base</th>
                                <th className="pb-3 text-right w-[9%]">Total Línea</th>
                                <th className="pb-3 text-center w-[4%]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {costItems.map(item => {
                                const quantity = item.quantity || 1;
                                const lineTotal = (item.amount || 0) * quantity;
                                return (
                                <tr key={item.id} className="text-xs font-bold text-slate-600 group">
                                    <td>
                                        <span className={`${item.category === 'Viáticos' ? 'text-emerald-600' : ''} ${item.category === 'Manual' ? 'text-purple-600' : ''}`}>
                                            {item.category}
                                        </span>
                                    </td>
                                    <td>
                                        <input 
                                            type="text" 
                                            value={item.description} 
                                            onChange={e => handleUpdateManualItem(item.id, 'description', e.target.value)} 
                                            className="w-full p-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-bold focus:ring-1 focus:ring-blue-200"
                                            placeholder="Descripción..."
                                        />
                                    </td>
                                    <td className="text-center">
                                        {(item.category === 'Manual' || (item.category !== 'Mano de Obra' && item.category !== 'Viáticos')) ? (
                                            <input 
                                                type="number" 
                                                value={item.quantity || ''} 
                                                onChange={e => handleUpdateManualItem(item.id, 'quantity', Number(e.target.value))} 
                                                className="w-16 p-1 rounded-md bg-slate-50 border border-slate-200 text-center font-mono text-xs font-bold focus:ring-1 focus:ring-blue-200"
                                                placeholder="1"
                                            />
                                        ) : (
                                            <span className="font-mono text-center block">{item.quantity || 1}</span>
                                        )}
                                    </td>
                                    <td className="text-right font-mono">
                                        {(item.category === 'Manual' || (item.category !== 'Mano de Obra' && item.category !== 'Viáticos')) ? (
                                            <input 
                                                type="number" 
                                                value={item.amount || ''} 
                                                onChange={e => handleUpdateManualItem(item.id, 'amount', Number(e.target.value))} 
                                                className="w-28 p-1 rounded-md bg-slate-50 border border-slate-200 text-right font-mono text-xs font-bold focus:ring-1 focus:ring-blue-200"
                                                placeholder="0.00"
                                            />
                                        ) : formatCurrency(item.amount, currency)}
                                    </td>
                                    <td className="text-right font-mono font-black text-blue-900/70">{formatCurrency(lineTotal, currency)}</td>
                                    <td className="text-center">
                                        <div className="flex justify-center gap-2">
                                            {(item.category === 'Mano de Obra' || item.category === 'Viáticos') && (
                                                <button type="button" onClick={() => handleEditItem(item)} className="text-blue-500 hover:text-blue-700 transition-all" title={item.category === 'Viáticos' ? 'Editar Viáticos' : 'Editar Cuadrilla'}>
                                                    <FiEdit  />
                                                </button>
                                            )}
                                            <button 
                                                type="button" 
                                                onClick={async () => {
                                                    const isConfirmed = await confirm({
                                                        title: 'Confirmar Eliminación',
                                                        description: `¿Está seguro que desea eliminar la línea "${item.description || item.category}"? Esta acción no se puede deshacer.`,
                                                        confirmLabel: 'Eliminar',
                                                        variant: 'danger'
                                                    });
                                                    if (isConfirmed) {
                                                        setCostItems(costItems.filter(i => i.id !== item.id));
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-700 transition-all" title="Eliminar">
                                                <FiTrash2  />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4} className="pt-8 text-right text-sm font-bold text-slate-500">Subtotal</td>
                                <td className="pt-8 text-right font-mono font-bold text-slate-500">{formatCurrency(financials.direct + financials.indirect, currency)}</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colSpan={3}></td>
                                <td colSpan={2} className="pt-4">
                                    <div className="flex items-center justify-between border-t pt-4">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="apply-tax" checked={applyTax} onChange={e => setApplyTax(e.target.checked)} className="w-5 h-5 accent-blue-600 rounded cursor-pointer" />
                                            <label htmlFor="apply-tax" className="text-sm font-bold text-slate-700 cursor-pointer">Añadir 13% IVA</label>
                                        </div>
                                        <span className="font-mono text-sm font-bold text-slate-500">
                                            {applyTax && formatCurrency((financials.direct + financials.indirect) * 0.13, currency)}
                                        </span>
                                    </div>
                                </td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colSpan={3}></td>
                                <td colSpan={2} className="pt-4">
                                    <div className="flex justify-between items-center bg-slate-100 p-3 rounded-xl">
                                        <span className="text-sm font-black text-blue-900 uppercase">Total General</span>
                                        <span className="text-xl font-black font-mono text-blue-900 tracking-tight">
                                            {formatCurrency((financials.direct + financials.indirect) * (applyTax ? 1.13 : 1), currency)}
                                        </span>
                                    </div>
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>

                                        <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-start">
                        <ActionButton 
                            label="Agregar línea"
                            onClick={handleAddManualLine}
                        />
                    </div>
                </div>
            )}
            {/* ... resto de las pestañas sensitivity y cashflow ... */}
        </div>
      </div>

      {/* Panel Ejecutivo */}
      <div className="w-full lg:w-[380px] flex-none space-y-6">
        <div className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 space-y-8">
                <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Utilidad Estimada</span>
                    <h2 className={`text-4xl font-black tracking-tight ${financials.utility >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(financials.utility, currency)}</h2>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xl font-black ${financials.margin >= targetMargin ? 'text-emerald-500' : 'text-amber-500'}`}>{(Number(financials.margin) || 0).toFixed(1)}%</span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Margen Bruto</span>
                    </div>
                </div>
            </div>
        </div>
        <ActionButton 
            label={initialData ? "Actualizar Evaluación Estratégica" : "Guardar Evaluación Estratégica"} 
            fullWidth 
            onClick={() => onSubmit({ ...financials, projectName, client, contact, estimatedBudget: financials.budgetNum, currency, durationMonths: duration, contingencyPercent: contingency, targetMargin, costItems, sensitivity, riskFactors })}
            disabled={!projectName || costItems.length === 0}
        />
        <button type="button" onClick={onClose} className="w-full py-3 text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors">Descartar Simulación</button>
      </div>

      {/* MODAL DIRECTORIO */}
      <ClientDirectoryModal 
        show={showClientModal}
        onClose={() => setShowClientModal(false)}
        clients={savedClients}
        hasMore={hasMoreClients}
        onLoadMore={loadMoreClients}
        isLoadingMore={loadingMoreClients}
        onSelect={(c) => {
            setClient(c.empresa);
            setContact(c.contacto);
            setShowClientModal(false);
        }}
        onDelete={(e, c) => deactivateClient(c.id)}
      />
    </div>
  );
};

const SensitivitySlider = ({ label, value, min, max, onChange, color }: any) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
            <span className={`text-xs font-black text-${color}-600`}>{value > 0 ? '+' : ''}{value}%</span>
        </div>
        <input type="range" min={min} max={max} step="1" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
    </div>
);

const RiskSlider = ({ label, value, onChange }: any) => (
    <div className="space-y-1">
        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
            <span>{label}</span>
            <span>Nivel {value}</span>
        </div>
        <input type="range" min={1} max={3} step="1" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-1 bg-slate-100 appearance-none rounded-full accent-blue-900" />
    </div>
);

export default PreAnalysisModule;
import React, { useState, useMemo, useEffect } from 'react';
import { User } from '@/utils/types';
import { PayrollStatus } from '../../../financeTypes';
import { useFinance } from '../../../hooks/useFinance';
import { formatCurrency } from '../../../utils/formatCurrency';
import { 
  Toolbar, 
  DataTable, 
  TableColumn, 
  SearchInput, 
  StatusBadge,
  ActionButton,
  IconButton,
  ACTION_ICONS,
  ConfirmModal
} from '../../../design-system';
import { PayrollActionsService } from './services/payrollActions.service';
import { PayrollWorkflowService } from './services/payrollWorkflow.service';
import { ModulePage } from '../../../components/ui/ModulePage';
import { FiCheck, FiSearch, FiLock, FiDollarSign } from "react-icons/fi";

interface Props {
  currentUser: User;
}

const CorporatePayrollView: React.FC<Props> = ({ currentUser }) => {
  const { employees } = useFinance(currentUser);
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedFortnight, setSelectedFortnight] = useState<'Primera' | 'Segunda'>('Primera');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [payrollStatus, setPayrollStatus] = useState<PayrollStatus>('GENERATED');
  const [isSyncing, setIsSyncing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean, next: PayrollStatus | null }>({ show: false, next: null });

  const periodId = `${selectedYear}-${selectedMonth}-${selectedFortnight}`;

  useEffect(() => {
    const syncStatus = async () => {
      setIsSyncing(true);
      try {
        const master = await PayrollWorkflowService.getPayrollMaster(periodId);
        setPayrollStatus(master?.status || 'GENERATED');
      } catch (e) {
        console.error("Sync Error", e);
      } finally {
        setIsSyncing(false);
      }
    };
    syncStatus();
  }, [periodId, currentUser]);

  const periodLabel = useMemo(() => {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${selectedFortnight} Q. ${months[selectedMonth - 1]} ${selectedYear}`;
  }, [selectedMonth, selectedYear, selectedFortnight]);

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.isActive && !e.isArchived);
  }, [employees]);

  const payrollData = useMemo(() => {
    return activeEmployees.map(emp => {
      const base = Math.round((emp.baseSalary / 2) * 100) / 100;
      const deductions = Math.round((emp.ccssDeduction / 2) * 100) / 100;
      const charges = Math.round((base * 0.265) * 100) / 100;
      const netPay = Math.round((base - deductions) * 100) / 100;

      const costCenter = emp.position.toLowerCase().includes('tecnico') || 
                         emp.position.toLowerCase().includes('técnico') 
        ? 'OPERATIVO' : 'ADMINISTRATIVO';

      return { ...emp, costCenter, base, deductions, charges, netPay };
    });
  }, [activeEmployees]);

  const totals = useMemo(() => {
    return payrollData.reduce((acc, row) => ({
      gross: acc.gross + row.base,
      charges: acc.charges + row.charges,
      net: acc.net + row.netPay,
      count: acc.count + 1
    }), { gross: 0, charges: 0, net: 0, count: 0 });
  }, [payrollData]);

  const filteredData = useMemo(() => {
    return payrollData.filter(row => 
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      row.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [payrollData, searchTerm]);

  const requestTransition = (next: PayrollStatus) => {
    setShowConfirm({ show: true, next });
  };

  const handleExecuteTransition = async () => {
    if (!showConfirm.next) return;
    setIsProcessing(true);
    try {
      await PayrollWorkflowService.transitionTo(periodId, payrollStatus, showConfirm.next, {
        email: currentUser.email,
        totals
      });
      setPayrollStatus(showConfirm.next);
      setShowConfirm({ show: false, next: null });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const columns: TableColumn<any>[] = [
    {
      header: "Empleado",
      render: (row) => (
        <div>
            <p className="font-black text-blue-900">{row.name}</p>
            <p className="text-[10px] font-mono text-slate-400 uppercase">{row.employeeCode}</p>
        </div>
      )
    },
    {
        header: "Salario Quincenal",
        align: "right",
        render: (row) => <span className="font-mono font-bold text-slate-600">{formatCurrency(row.base)}</span>
    },
    {
        header: "Neto a Pagar",
        align: "right",
        className: "bg-slate-50/50",
        render: (row) => <span className="font-mono font-black text-blue-900">{formatCurrency(row.netPay)}</span>
    },
    {
        header: "Estado",
        align: "center",
        render: () => <StatusBadge label="Calculado" variant="success" icon={<FiCheck  />} />
    }
  ];

  const getStepConfig = () => {
    switch (payrollStatus) {
      case 'GENERATED': return { next: 'REVIEWED', label: 'Marcar como Revisada', variant: 'primary' as any, icon: <FiSearch /> };
      case 'REVIEWED': return { next: 'APPROVED', label: 'Aprobar Planilla', variant: 'warning' as any, icon: <FiLock /> };
      case 'APPROVED': return { next: 'PAID', label: 'Registrar Pago Ejecutado', variant: 'success' as any, icon: <FiDollarSign /> };
      default: return null;
    }
  };

  const config = getStepConfig();

  const periodSelectors = (
    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-sm">
      <select value={selectedFortnight} onChange={(e) => setSelectedFortnight(e.target.value as any)} className="bg-transparent text-[10px] font-black uppercase outline-none">
          <option value="Primera">1ra Quincena</option>
          <option value="Segunda">2da Quincena</option>
      </select>
      <div className="w-px h-4 bg-slate-300"></div>
      <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-[10px] font-black uppercase outline-none">
          {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
          ))}
      </select>
    </div>
  );

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage 
        title="Planilla Corporativa" 
        subtitle={`Motor de Nómina - ${periodLabel}`}
        rightContent={periodSelectors}
      >
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-8">
              {/* Workflow Progress */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                  <div className="flex items-center justify-between min-w-[500px]">
                    {['GENERATED', 'REVIEWED', 'APPROVED', 'PAID'].map((step, idx, arr) => {
                        const stepIndex = arr.indexOf(step);
                        const currentIndex = arr.indexOf(payrollStatus);
                        const isCompleted = stepIndex <= currentIndex;
                        const labels: any = { GENERATED: 'Generada', REVIEWED: 'Revisada', APPROVED: 'Aprobada', PAID: 'Pagada' };
                        return (
                          <React.Fragment key={step}>
                              <div className="flex flex-col items-center flex-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-[10px] font-black transition-all ${
                                    isCompleted ? 'bg-blue-900 border-blue-900 text-white' : 'bg-white border-slate-200 text-slate-300'
                                }`}>
                                    {isCompleted ? <FiCheck  /> : idx + 1}
                                </div>
                                <span className={`text-[9px] font-black uppercase mt-2 ${isCompleted ? 'text-blue-900' : 'text-slate-400'}`}>
                                    {labels[step]}
                                </span>
                              </div>
                              {idx < arr.length - 1 && <div className={`flex-[2] h-0.5 ${stepIndex < currentIndex ? 'bg-blue-900' : 'bg-slate-200'}`}></div>}
                          </React.Fragment>
                        );
                    })}
                  </div>
              </div>

              <Toolbar 
                left={<SearchInput placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />}
                right={
                  <div className="flex gap-4">
                    <IconButton icon={<ACTION_ICONS.excel />} variant="success" onClick={() => PayrollActionsService.exportToExcel(payrollData, periodLabel)} />
                    <IconButton icon={<ACTION_ICONS.pdf />} variant="danger" onClick={() => PayrollActionsService.exportToPDF(payrollData, totals, periodLabel)} />
                  </div>
                }
              />
              
              <DataTable 
                data={filteredData} 
                columns={columns} 
                keyExtractor={(item) => item.id} 
                isLoading={isSyncing}
                enableVirtualization={true}
                virtualHeight={600}
              />
            </div>

            {/* Panel de Control de Transición */}
            <div className="w-full md:w-80 flex flex-col gap-6">
                <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                    <h2 className="text-xl font-black uppercase mb-6 tracking-tight">Acciones de Flujo</h2>
                    
                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
                            <span>Total Bruto</span>
                            <span className="text-white font-mono">{formatCurrency(totals.gross)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
                            <span>Neto a Pagar</span>
                            <span className="text-blue-400 font-mono text-sm">{formatCurrency(totals.net)}</span>
                        </div>
                    </div>

                    {config ? (
                      <ActionButton 
                        label={config.label}
                        variant={config.variant}
                        fullWidth
                        icon={config.icon}
                        onClick={() => requestTransition(config.next as PayrollStatus)}
                        disabled={isProcessing || isSyncing}
                      />
                    ) : (
                      <div className="text-center p-4 bg-slate-800 rounded-2xl border border-slate-700">
                          <FiCheck className="text-emerald-500 mb-2 text-xl"  />
                          <p className="text-[10px] font-black uppercase text-emerald-400">Proceso Finalizado</p>
                      </div>
                    )}
                    
                    <button 
                        onClick={() => PayrollActionsService.generateBankFile(payrollData)}
                        className="w-full mt-4 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors"
                    >
                        DESCARGAR TXT BANCARIO
                    </button>
                </div>
            </div>
          </div>

        <ConfirmModal 
          show={showConfirm.show}
          onClose={() => setShowConfirm({ show: false, next: null })}
          onConfirm={handleExecuteTransition}
          isLoading={isProcessing}
          title={`¿Confirmar ${showConfirm.next}?`}
          description="Esta acción moverá la planilla al siguiente estado en la cadena de mando. Esta acción queda registrada en la bitácora de auditoría."
          variant="warning"
        />
      </ModulePage>
    </div>
  );
};

export default CorporatePayrollView;
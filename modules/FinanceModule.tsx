import React, { useState, useMemo, useEffect, lazy, Suspense, useCallback } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Employee, AbsenceRecord, PayStub } from '../financeTypes';
import { User } from '../utils/types';
import { EmployeeModal } from './EmployeeModal';
import { EmployeeRecordModal } from './finance/components/EmployeeRecordModal'; 
import { EmployeeExportPdfModal, EMPLOYEE_PDF_EXPORT_COLUMNS } from './finance/components/EmployeeExportPdfModal';
import { AbsenceModal } from './AbsenceModal';
import { PaystubModal } from './PaystubModal';
import { PayrollActionsService } from './finance/payroll/services/payrollActions.service';

// Modulos Lazy
const LazyMovimientosFinancieros = lazy(() => import('./CashflowModule'));
const LazyProjectAnalysisModule = lazy(() => import('./ProjectAnalysisModule'));
const LazyInvoiceManager = lazy(() => import('./finance/invoices/InvoiceManager').then(m => ({ default: m.InvoiceManager })));
const LazyPurchaseOrderModule = lazy(() => import('./finance/purchase_orders/PurchaseOrderModule'));
const LazyInventoryModule = lazy(() => import('./InventoryModule'));
const LazyInventoryMovementsModule = lazy(() => import('./InventoryMovementsModule'));
const LazyMaterialRequestsModule = lazy(() => import('./MaterialRequestsModule'));
const LazyReporteMaterialesProyecto = lazy(() => import('./inventario/ReporteMaterialesProyecto'));
const LazyCorporatePayrollView = lazy(() => import('./finance/payroll/CorporatePayrollView'));

const PreAnalysisModule = lazy(() => import('./finance/pre_analysis/PreAnalysisModule'));

import { generatePaystubPDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/formatCurrency';
import { isAdmin, hasPermission } from '../utils/permissions';
import { ModulePage } from '../components/ui/ModulePage';
import { ActionButton, IconButton, Toolbar, ACTION_ICONS, DataTable, SearchInput, TableColumn, ConfirmModal, StatusBadge } from '../design-system';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { ActionButtons } from '../components/ui/ActionButtons'; 
import { AutomaticAdjustmentsSection } from './finance/automatic_adjustments/AutomaticAdjustmentsSection';
import { triggerFileDownload } from '../utils/fileUtils';

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

interface FinanceModuleProps {
  currentUser: User | null;
  activeView?: string;
  selectedId?: string;
  selectedKey?: string;
  jobId?: string;
  otCode?: string;
  onClearSelectedId?: () => void;
  onSetActiveModule?: (moduleData: string | { 
    module: string; 
    selectedId?: string; 
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
  }) => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({ 
  currentUser, 
  activeView, 
  selectedId, 
  selectedKey, 
  jobId,
  otCode,
  onClearSelectedId, 
  onSetActiveModule 
}) => {
  const [internalActiveTab] = useState<string>('employees');
  const currentTab = activeView || internalActiveTab;
  
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showExportPdfModal, setShowExportPdfModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false); 
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showPaystubModal, setShowPaystubModal] = useState(false);
  const [editingPayStub, setEditingPayStub] = useState<PayStub | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipNotification, setZipNotification] = useState<{ message: string, type: 'info' | 'error' } | null>(null);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null); 
  
  const [safetyGuard, setSafetyGuard] = useState<{
    show: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    isLoading: boolean;
    icon?: React.ElementType;
  }>({
    show: false,
    title: '',
    description: '',
    onConfirm: () => {},
    isLoading: false
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterAbsenceFortnight] = useState<'all' | 'Primera' | 'Segunda'>('all');
  const [selectedPeriod] = useState<string>('all');
  const [filterStubMonth, setFilterStubMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [filterStubFortnight, setFilterStubFortnight] = useState<'all' | 'Primera' | 'Segunda'>('all');
  const [stubsActiveTab, setStubsActiveTab] = useState<'historial' | 'ajustes'>('historial');

  // Auto-dismiss info notifications
  useEffect(() => {
    if (zipNotification && zipNotification.type === 'info') {
      const timer = setTimeout(() => {
        setZipNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [zipNotification]);

  // Clear notifications on filter changes
  useEffect(() => {
      setZipNotification(null);
  }, [filterYear, filterStubMonth, filterStubFortnight, searchTerm, selectedPeriod]);

  const stubFilters = useMemo(() => {
    if (viewingEmployee) {
      return { employeeEmail: viewingEmployee.email };
    }
    return { year: filterYear, month: filterStubMonth, fortnight: filterStubFortnight };
  }, [viewingEmployee, filterYear, filterStubMonth, filterStubFortnight]);

  const { 
    employees, absenceRecords, payStubs, isLoading, automaticAdjustments,
    addOrUpdateEmployee, archiveEmployee, reactivateEmployee, deleteEmployee, resetEmployeePassword, adminSetPassword,
    addOrUpdateAbsence, deleteAbsence,
    addOrUpdatePayStub, deletePayStub,
    saveAutomaticAdjustment, removeAutomaticAdjustment
  } = useFinance(currentUser, stubFilters);

  // Precarga inteligente del módulo de análisis
  useEffect(() => {
    const timer = setTimeout(() => {
      // Prefetch eliminado para optimizar recursos iniciales
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
        if (showArchived) {
            if (emp.status !== 'archivado') return false;
        } else {
            if (emp.status === 'archivado') return false;
        }
        const term = searchTerm.toLowerCase();
        return emp.name.toLowerCase().includes(term) || 
               emp.position.toLowerCase().includes(term);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, searchTerm, showArchived]);

  const activeEmployees = useMemo(() => employees.filter(e => e.status !== 'archivado' && !e.isArchived), [employees]);

  const filteredAbsences = useMemo(() => {
    return absenceRecords.filter(abs => {
      const emp = employees.find(e => e.id === abs.employeeId);
      const term = searchTerm.toLowerCase();
      if (!emp) return false;
      
      const matchesSearch = emp.name.toLowerCase().includes(term) || 
                          emp.position.toLowerCase().includes(term);
      if (!matchesSearch) return false;
                           
      if (!abs.startDate) return false;
      const dateParts = abs.startDate.split('-');
      const absYear = dateParts[0];
      const absMonth = parseInt(dateParts[1], 10);
      const absDay = parseInt(dateParts[2], 10);
      const absFortnight = absDay <= 15 ? 'Primera' : 'Segunda';

      const matchesYear = filterYear === 'all' || absYear === filterYear;
      const matchesMonth = filterMonth === 'all' || absMonth.toString() === filterMonth;
      const matchesFortnight = filterAbsenceFortnight === 'all' || absFortnight === filterAbsenceFortnight;
      
      return matchesYear && matchesMonth && matchesFortnight;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [absenceRecords, employees, searchTerm, filterMonth, filterYear, filterAbsenceFortnight]);

  const availableStubYears = useMemo(() => {
    const years = new Set<string>([new Date().getFullYear().toString()]);
    payStubs.forEach(s => years.add(s.year.toString()));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [payStubs]);

  const filteredStubs = useMemo(() => {
    return payStubs.filter(stub => {
      // Validación de seguridad: Admin ve todo, otros solo su email
      if (!currentUser || !isAdmin(currentUser.role || '')) {
        const emp = employees.find(e => e.id === stub.employeeId);
        const userEmail = currentUser?.email || '';
        
        // Verificar por email si existe, sino por id de empleado
        const isOwner = stub.employeeEmail 
            ? stub.employeeEmail === userEmail 
            : (emp && emp.email === userEmail);
            
        if (!isOwner) return false;
      }
      
      const emp = employees.find(e => e.id === stub.employeeId);
      const term = searchTerm.toLowerCase();
      const matchesSearch = emp ? (emp.name.toLowerCase().includes(term) || emp.position.toLowerCase().includes(term)) : false;
      
      const matchesYear = filterYear === 'all' || stub.year.toString() === filterYear;
      const matchesMonth = filterStubMonth === 'all' || stub.month.toString() === filterStubMonth;
      const matchesFortnight = filterStubFortnight === 'all' || stub.fortnight === filterStubFortnight;
      const matchesPeriod = selectedPeriod === 'all' || stub.periodo === selectedPeriod;

      return matchesSearch && matchesYear && matchesMonth && matchesFortnight && matchesPeriod;
    });
  }, [payStubs, employees, searchTerm, selectedPeriod, filterStubMonth, filterStubFortnight, filterYear, currentUser]);

  const handleConfirmDeleteAbsence = (id: string) => {
    setSafetyGuard({
      show: true,
      title: '¿Eliminar Incidencia?',
      description: 'Esta acción eliminará permanentemente el registro de la incidencia. ¿Desea continuar?',
      icon: ACTION_ICONS.delete,
      onConfirm: async () => {
        setSafetyGuard(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteAbsence(id);
          setSafetyGuard(prev => ({ ...prev, show: false, isLoading: false }));
        } catch (error) {
          console.error("Error deleting absence:", error);
          setSafetyGuard(prev => ({ ...prev, isLoading: false }));
        }
      },
      isLoading: false
    });
  };

  const handleConfirmDeletePayStub = useCallback((id: string) => {
    setSafetyGuard({
      show: true,
      title: '¿Eliminar Colilla?',
      description: 'Esta acción eliminará permanentemente esta colilla de pago. ¿Desea continuar?',
      icon: ACTION_ICONS.delete,
      onConfirm: async () => {
        setSafetyGuard(prev => ({ ...prev, isLoading: true }));
        try {
          await deletePayStub(id);
          setSafetyGuard(prev => ({ ...prev, show: false, isLoading: false }));
        } catch (error) {
          console.error("Error deleting paystub:", error);
          setSafetyGuard(prev => ({ ...prev, isLoading: false }));
        }
      },
      isLoading: false
    });
  }, [deletePayStub]);

  const handleExportZIP = async () => {
    setIsExportingZip(true);
    setZipNotification(null);
    try {
        await PayrollActionsService.exportVisibleStubsToZIP(filteredStubs, employees);
        setZipNotification({ message: "Exportación completada exitosamente.", type: 'info' });
    } catch (e: any) {
        if (e.message.includes("No hay colillas")) {
            setZipNotification({ message: "No hay registros disponibles para exportar.", type: 'info' });
        } else {
            setZipNotification({ message: e.message, type: 'error' });
        }
    } finally {
        setIsExportingZip(false);
    }
  };

  const handleConfirmArchiveEmployee = useCallback((id: string) => {
    setSafetyGuard({
      show: true,
      title: '¿Archivar Colaborador?',
      description: 'Esta acción enviará al colaborador a la lista de archivados. ¿Desea continuar?',
      icon: ACTION_ICONS.archive,
      onConfirm: async () => {
        setSafetyGuard(prev => ({ ...prev, isLoading: true }));
        try {
          await archiveEmployee(id);
          setSafetyGuard(prev => ({ ...prev, show: false, isLoading: false }));
        } catch (error) {
          console.error("Error archiving employee:", error);
          setSafetyGuard(prev => ({ ...prev, isLoading: false }));
        }
      },
      isLoading: false
    });
  }, [archiveEmployee]);

  const handleConfirmReactivateEmployee = useCallback((id: string) => {
    setSafetyGuard({
      show: true,
      title: '¿Reactivar Colaborador?',
      description: 'Esta acción restaurará al colaborador a la lista de activos. ¿Desea continuar?',
      icon: ACTION_ICONS.undo,
      onConfirm: async () => {
        setSafetyGuard(prev => ({ ...prev, isLoading: true }));
        try {
          await reactivateEmployee(id);
          setSafetyGuard(prev => ({ ...prev, show: false, isLoading: false }));
        } catch (error) {
          console.error("Error reactivating employee:", error);
          setSafetyGuard(prev => ({ ...prev, isLoading: false }));
        }
      },
      isLoading: false
    });
  }, [reactivateEmployee]);

  const handleConfirmDeleteEmployee = useCallback((id: string) => {
    setSafetyGuard({
      show: true,
      title: '¿Eliminar Colaborador?',
      description: 'Esta acción eliminará permanentemente el registro del colaborador y todos sus datos asociados. Esta acción es irreversible. ¿Desea continuar?',
      icon: ACTION_ICONS.delete,
      onConfirm: async () => {
        setSafetyGuard(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteEmployee(id);
          setSafetyGuard(prev => ({ ...prev, show: false, isLoading: false }));
        } catch (error) {
          console.error("Error deleting employee:", error);
          setSafetyGuard(prev => ({ ...prev, isLoading: false }));
        }
      },
      isLoading: false
    });
  }, [deleteEmployee]);

  const handleExportEmployeesExcel = () => {
    const data = filteredEmployees.map(emp => ({
        "ID Colaborador": emp.employeeCode,
        "Nombre": emp.name,
        "Cargo": emp.position,
        "Fecha Ingreso": emp.hireDate || '---',
        "Email": emp.email,
        "Teléfono": emp.phone,
        "Salario Bruto": emp.baseSalary,
        "Deducción CCSS": emp.ccssDeduction,
        "Estado": emp.status === 'activo' ? 'Activo' : 'Inactivo',
        "Archivado": emp.status === 'archivado' ? 'SÍ' : 'NO'
    }));
    exportToExcel(data, `Lista_Colaboradores_${showArchived ? 'Archivados' : 'Activos'}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportEmployeesPDF = async (
    employeesToExport: Employee[] = filteredEmployees,
    selectedColumns: string[] = EMPLOYEE_PDF_EXPORT_COLUMNS.map(col => col.key)
  ) => {
    const formatNumberOnly = (num: number) => {
        return new Intl.NumberFormat('es-CR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const data = employeesToExport.map(emp => ({
        code: emp.employeeCode,
        name: emp.name,
        pos: emp.position,
        hire: emp.hireDate ? new Date(emp.hireDate + 'T00:00:00').toLocaleDateString('es-CR') : '---',
        currency: 'CRC',
        salary: formatNumberOnly(emp.baseSalary),
        status: emp.status === 'activo' ? 'Activo' : 'Inactivo'
    }));

    const columns = EMPLOYEE_PDF_EXPORT_COLUMNS
      .filter(col => selectedColumns.includes(col.key))
      .map(col => ({
        header: col.header,
        dataKey: col.dataKey,
        width: col.width,
        align: col.align,
        isCurrency: col.isCurrency
      }));

    await exportToPDF({
        title: "Reporte de Colaboradores",
        subtitle: `Directorio de personal (${showArchived ? 'Archivados' : 'Activos'})`,
        fileName: "Reporte_Colaboradores",
        columns: columns,
        data: data
    });
  };

  const employeeColumns = useMemo<TableColumn<Employee>[]>(() => [
    {
      header: "Nombre / Cargo",
      mobileGrid: "full",
      mobileOrder: 1,
      width: "35%",
      className: "border-r border-slate-100",
      render: (emp) => (
        <div className="flex flex-col min-w-0" style={{ maxWidth: '100%' }}>
            <p className="font-bold text-blue-900 truncate" title={emp.name}>{emp.name}</p>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest truncate" title={emp.position}>{emp.position}</p>
        </div>
      )
    },
    {
        header: "Ingreso",
        align: "center",
        mobileGrid: "left",
        mobileOrder: 2,
        width: "15%",
        className: "border-r border-slate-100",
        render: (emp) => <span className="font-mono text-slate-500 truncate" title={emp.hireDate ? new Date(emp.hireDate + 'T00:00:00').toLocaleDateString('es-CR') : '---'}>{emp.hireDate ? new Date(emp.hireDate + 'T00:00:00').toLocaleDateString('es-CR') : '---'}</span>
    },
    {
        header: "Sal. Bruto",
        align: "center",
        mobileGrid: "right",
        mobileOrder: 3,
        width: "20%",
        className: "border-r border-slate-100",
        render: (emp) => <span className="font-mono text-slate-600 font-bold truncate" title={formatCurrency(emp.baseSalary)}>{formatCurrency(emp.baseSalary)}</span>
    },
    {
        header: "Estado",
        align: "center",
        mobileGrid: "right",
        mobileOrder: 4,
        width: "15%",
        className: "border-r border-slate-100",
        render: (emp) => (
            <StatusBadge 
                label={emp.status === 'activo' ? 'Activo' : 'Inactivo'} 
                variant={emp.status === 'activo' ? 'success' : 'danger'} 
            />
        )
    },
    {
        header: "Acciones",
        align: "center",
        mobileGrid: "full",
        mobileOrder: 5,
        width: "15%",
        render: (emp) => isAdmin(currentUser?.role) ? (
            <div className="flex justify-center gap-1">
                <ActionButtons 
                    onView={() => { setViewingEmployee(emp); setShowRecordModal(true); }}
                    onEdit={() => { setEditingItem({ ...emp }); setShowEmployeeModal(true); }}
                    viewTitle="Ver Expediente"
                />
                {showArchived ? (
                    <>
                        <IconButton icon={<ACTION_ICONS.undo />} variant="success" onClick={() => handleConfirmReactivateEmployee(emp.id)} title="Reactivar" />
                        <IconButton icon={<ACTION_ICONS.delete />} variant="danger" onClick={() => handleConfirmDeleteEmployee(emp.id)} title="Eliminar Definitivamente" />
                    </>
                ) : (
                    <IconButton icon={<ACTION_ICONS.archive />} variant="warning" onClick={() => handleConfirmArchiveEmployee(emp.id)} title="Archivar" />
                )}
            </div>
        ) : (
            <div className="flex justify-center">
                <IconButton 
                    icon={<ACTION_ICONS.view />} 
                    variant="primary" 
                    onClick={() => { setViewingEmployee(emp); setShowRecordModal(true); }} 
                    title="Ver Expediente" 
                />
            </div>
        )
    }
  ], [currentUser?.role, showArchived, handleConfirmArchiveEmployee, handleConfirmReactivateEmployee, handleConfirmDeleteEmployee]);

  const stubColumns = useMemo<TableColumn<PayStub>[]>(() => [
      {
          header: "Colaborador",
          render: (s) => {
              const emp = employees.find(e => e.id === s.employeeId);
              return <span className="font-bold text-blue-900">{emp?.name || '---'}</span>;
          }
      },
      {
          header: "Periodo",
          accessorKey: "periodo",
          className: "font-medium text-slate-500"
      },
      {
          header: "Planilla",
          accessorKey: "planillaId",
          className: "font-medium text-slate-500"
      },
      {
          header: "Neto",
          align: "right",
          render: (s) => <span className="font-mono font-black text-slate-700">{formatCurrency(s.netPay)}</span>
      },
      {
          header: "Acciones",
          align: "center",
          render: (s) => {
              const emp = employees.find(e => e.id === s.employeeId);
              return (
                <div className="flex justify-center gap-2">
                    <IconButton 
                        icon={<ACTION_ICONS.edit />} 
                        onClick={() => { setEditingPayStub(s); setShowPaystubModal(true); }} 
                        variant="primary" 
                    />
                    <IconButton 
                        icon={<ACTION_ICONS.pdf />} 
                        onClick={async () => {
                            if (emp) {
                                const { fileBlob } = await generatePaystubPDF(s, emp);
                                const nameParts = emp.name.toUpperCase().split(' ').filter(Boolean).join('_');
                                const Q = s.fortnight === 'Primera' ? 'Q1' : 'Q2';
                                const monthStr = s.month.toString().padStart(2, '0');
                                const fileName = `COLILLA_${nameParts}_${s.year}_${monthStr}_${Q}.pdf`.replace(/[^A-Z0-9_.]/g, '');
                                triggerFileDownload(fileBlob, fileName);
                            }
                        }} 
                        variant="danger" 
                    />
                    <IconButton 
                        icon={<ACTION_ICONS.delete />} 
                        onClick={() => handleConfirmDeletePayStub(s.id)} 
                        variant="danger" 
                    />
                </div>
              );
          }
      }
  ], [employees, handleConfirmDeletePayStub]);

  const [openedTabs, setOpenedTabs] = useState<Set<string>>(new Set([currentTab || 'cashflow']));

  useEffect(() => {
    if (!currentTab) return;
    setOpenedTabs(prev => {
      if (prev.has(currentTab)) return prev;
      const next = new Set(prev);
      next.add(currentTab);
      return next;
    });
  }, [currentTab]);

  if (!currentUser) return null;

  const renderContent = () => {
      const Fallback = <div className="p-8 text-center text-slate-400 font-bold">Cargando módulo...</div>;
      
      const tabConfigs = [
        { id: 'cashflow', label: 'Movimientos Financieros', component: <LazyMovimientosFinancieros currentUser={currentUser} selectedId={selectedId} onClearSelectedId={onClearSelectedId} /> },
        { id: 'project_analysis', label: 'Análisis de Proyectos', component: <LazyProjectAnalysisModule currentUser={currentUser} /> },
        { id: 'pre_analysis', label: 'Pre-Análisis', component: <PreAnalysisModule currentUser={currentUser} /> },
        { id: 'billing', label: 'Facturación', component: <LazyInvoiceManager selectedId={selectedId} onClearSelectedId={onClearSelectedId} /> },
        { id: 'purchase_orders', label: 'Órdenes de Compra', component: <LazyPurchaseOrderModule currentUser={currentUser} /> },
        { id: 'payroll_corporate', label: 'Nómina Corporativa', component: <LazyCorporatePayrollView currentUser={currentUser} /> },
        { id: 'material_report', label: 'Reporte de Materiales', component: (
          <LazyReporteMaterialesProyecto 
            selectedId={selectedId} 
            initialProjectName={selectedKey} 
            initialJobId={jobId}
            initialOTCode={otCode}
            onClearSelectedId={onClearSelectedId} 
            onEditReport={(id) => onSetActiveModule?.({ module: 'material_report', selectedId: id })} 
            onBack={(target) => {
              if (target === 'job_scheduling') {
                onSetActiveModule?.('job_scheduling');
              } else {
                onSetActiveModule?.('material_reports');
              }
            }} 
          />
        ) },
        { id: 'inventory_general', label: 'Inventario General', component: <LazyInventoryModule currentUser={currentUser} selectedId={selectedId} selectedKey={selectedKey} onClearSelectedId={onClearSelectedId} /> },
        { id: 'inventory_movements', label: 'Movimientos de Inventario', component: <LazyInventoryMovementsModule currentUser={currentUser} selectedId={selectedId} selectedKey={selectedKey} onClearSelectedId={onClearSelectedId} /> },
        { id: 'material_reports', label: 'Solicitud de Materiales', component: <LazyMaterialRequestsModule currentUser={currentUser} selectedId={selectedId} selectedKey={selectedKey} onClearSelectedId={onClearSelectedId} /> },
      ];

      const renderTab = (tabId: string) => {
        if (tabId === 'employees') {
          return (
            <div className="-mx-2 md:-mx-4 -mt-4">
                <ModulePage title="Lista de Colaboradores" subtitle="Directorio de personal y perfiles de acceso.">
                      <Toolbar
                          left={
                              <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
                                  <div className="flex bg-slate-100 p-1 rounded-xl">
                                      <ActionButton 
                                          onClick={() => setShowArchived(false)}
                                          variant={!showArchived ? 'primary' : 'ghost'}
                                          label="Activos"
                                      />
                                      <ActionButton 
                                          onClick={() => setShowArchived(true)}
                                          variant={showArchived ? 'primary' : 'ghost'}
                                          label="Archivados"
                                      />
                                  </div>
                                  <SearchInput placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                              </div>
                          }
                          right={
                              <div className="flex items-center gap-2">
                                  <div className="flex gap-1 mr-2 border-r border-slate-200 pr-2">
                                      <IconButton icon={<ACTION_ICONS.excel />} variant="success" onClick={handleExportEmployeesExcel} title="Exportar Excel" />
                                      <IconButton icon={<ACTION_ICONS.pdf />} variant="danger" onClick={() => setShowExportPdfModal(true)} title="Exportar PDF" />
                                  </div>
                                  {isAdmin(currentUser?.role) && (
                                      <ActionButton onClick={() => { setEditingItem(null); setShowEmployeeModal(true); }} label="Nuevo Colaborador" />
                                  )}
                              </div>
                          }
                      />
                      <DataTable<Employee> data={filteredEmployees} columns={employeeColumns} keyExtractor={(emp) => emp.id} isLoading={isLoading} enableVirtualization={true} virtualHeight={600} />
                </ModulePage>
            </div>
          );
        }

        if (tabId === 'absences') {
          return (
            <div className="-mx-2 md:-mx-4 -mt-4">
                  <ModulePage title="Registro de Incidencias" subtitle="Control de incapacidades, permisos y ausencias.">
                      <Toolbar 
                          left={
                              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                                  <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full md:w-auto px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 outline-none">
                                      <option value="all">Año</option>
                                      {availableStubYears.map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full md:w-auto px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 outline-none">
                                      <option value="all">Mes</option>
                                      {monthNames.map((m, i) => <option key={m} value={(i+1).toString()}>{m}</option>)}
                                  </select>
                                  <SearchInput placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                              </div>
                          }
                          right={
                              <div className="flex items-center gap-2">
                                  <ActionButton onClick={() => { setEditingItem(null); setShowAbsenceModal(true); }} label="Nueva Ausencia" />
                              </div>
                          }
                      />
                      <DataTable<AbsenceRecord> 
                          data={filteredAbsences} 
                          enableVirtualization={true}
                          virtualHeight={600}
                          columns={[
                              { 
                                  header: "Colaborador", 
                                  render: (abs) => { 
                                      const emp = employees.find(e => e.id === abs.employeeId); 
                                      return <span className="font-bold text-blue-900">{emp?.name || '---'}</span>; 
                                  } 
                              }, 
                              { 
                                  header: "Tipo", 
                                  render: (abs) => <StatusBadge label={abs.type} variant={abs.type === 'Incapacidad' ? 'danger' : abs.type === 'Ausencia' ? 'warning' : 'info'} /> 
                              }, 
                              { 
                                  header: "Desde", 
                                  accessorKey: "startDate", 
                                  className: "font-mono text-slate-500" 
                              }, 
                              { 
                                  header: "Hasta", 
                                  accessorKey: "endDate", 
                                  className: "font-mono text-slate-500" 
                              }, 
                              { 
                                  header: "Acciones", 
                                  align: "center", 
                                  render: (abs) => (
                                      <div className="flex justify-center gap-2">
                                          <IconButton 
                                              icon={<ACTION_ICONS.edit />} 
                                              onClick={() => { setEditingItem(abs); setShowAbsenceModal(true); }} 
                                              variant="primary" 
                                              title="Editar"
                                          />
                                          <IconButton 
                                              icon={<ACTION_ICONS.delete />} 
                                              onClick={() => handleConfirmDeleteAbsence(abs.id)} 
                                              variant="danger" 
                                              title="Eliminar"
                                          />
                                      </div>
                                  ) 
                              }
                          ]} 
                          keyExtractor={(abs) => abs.id} 
                          isLoading={isLoading} 
                      />
                  </ModulePage>
            </div>
          );
        }

        if (tabId === 'stubs') {
          return (
            <div className="-mx-2 md:-mx-4 -mt-4">
                <div className="px-4 py-3 bg-white border-b border-slate-200 mb-4 overflow-x-auto">
                    <div className="flex gap-4 min-w-max">
                        <button
                            className={`px-4 py-2 font-bold text-sm tracking-wide transition-colors border-b-2 ${
                                stubsActiveTab === 'historial'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                            onClick={() => setStubsActiveTab('historial')}
                        >
                            HISTORIAL DE PAGOS
                        </button>
                        <button
                            className={`px-4 py-2 font-bold text-sm tracking-wide transition-colors border-b-2 ${
                                stubsActiveTab === 'ajustes'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                            onClick={() => setStubsActiveTab('ajustes')}
                        >
                            AJUSTES AUTOMÁTICOS
                        </button>
                    </div>
                </div>

                {stubsActiveTab === 'historial' && (
                  <div className={stubsActiveTab !== 'historial' ? 'hidden' : ''}>
                  <ModulePage title="HISTORIAL DE PAGOS" subtitle="Gestión y descarga de comprobantes de nómina.">
                      <Toolbar 
                          left={
                              <div className="grid grid-cols-2 md:flex md:flex-row gap-2 md:gap-4 w-full md:w-auto items-center">
                                  <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full md:w-auto px-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 outline-none min-h-[38px]">
                                      <option value="all">Año</option>
                                      {availableStubYears.map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                  <select value={filterStubMonth} onChange={e => setFilterStubMonth(e.target.value)} className="w-full md:w-auto px-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 outline-none min-h-[38px]">
                                      <option value="all">Mes</option>
                                      {monthNames.map((m, i) => <option key={m} value={(i+1).toString()}>{m}</option>)}
                                  </select>
                                  <select value={filterStubFortnight} onChange={e => setFilterStubFortnight(e.target.value as 'all' | 'Primera' | 'Segunda')} className="w-full md:w-auto px-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 outline-none min-h-[38px]">
                                      <option value="all">Todas</option>
                                      <option value="Primera">1ra Quincena</option>
                                      <option value="Segunda">2da Quincena</option>
                                  </select>
                                  <div className="w-full md:w-auto md:min-w-[200px] flex items-center min-h-[38px]">
                                      <SearchInput placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                  </div>
                              </div>
                          }
                          right={
                              currentUser && (isAdmin(currentUser?.role) || hasPermission(currentUser, 'finanzas', 'comprobantes')) &&
                              <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
                                  <ActionButton 
                                      onClick={handleExportZIP} 
                                      label={isExportingZip ? "Procesando" : "Exportar ZIP"} 
                                      variant="warning" 
                                      icon={<ACTION_ICONS.files />}
                                      disabled={isExportingZip} 
                                      className="w-full justify-center !px-2 md:!px-4"
                                  />
                                  <ActionButton onClick={() => setShowPaystubModal(true)} label="Generar Nuevo" variant="success" className="w-full justify-center !px-2 md:!px-4" />
                              </div>
                          }
                      />
                      {zipNotification && (
                           <div className={`mb-4 mt-2 p-4 rounded-xl border flex items-center justify-between ${zipNotification.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                               <div className={`flex items-center gap-3 ${zipNotification.type === 'error' ? 'text-red-800' : 'text-amber-800'}`}>
                                  <StatusBadge label={zipNotification.type === 'error' ? "Error" : "Info"} variant={zipNotification.type === 'error' ? "danger" : "warning"} />
                                  <span className="font-medium text-sm">{zipNotification.message}</span>
                               </div>
                               <button onClick={() => setZipNotification(null)} className={`${zipNotification.type === 'error' ? 'text-red-600' : 'text-amber-700'} hover:text-red-800 font-bold text-sm`}>Cerrar</button>
                           </div>
                      )}
                      <DataTable<PayStub> data={filteredStubs} columns={stubColumns} keyExtractor={(s) => s.id} isLoading={isLoading} enableVirtualization={true} virtualHeight={600} />
                  </ModulePage>
                  </div>
                )}

                {stubsActiveTab === 'ajustes' && (
                  <div className={stubsActiveTab !== 'ajustes' ? 'hidden' : ''}>
                  <AutomaticAdjustmentsSection 
                    currentUser={currentUser} 
                    employees={activeEmployees} 
                    adjustments={automaticAdjustments || []}
                    onSave={saveAutomaticAdjustment}
                    onDelete={removeAutomaticAdjustment}
                    payStubs={payStubs}
                  />
                  </div>
                )}
            </div>
          );
        }
        return null;
      };

      return (
        <Suspense fallback={Fallback}>
          {Array.from(openedTabs).map(tabId => {
            const config = tabConfigs.find(c => c.id === tabId);
            if (config) {
              return (
                <div key={tabId} className={currentTab !== tabId ? 'hidden' : ''}>
                  {config.component}
                </div>
              );
            }
            return (
              <div key={tabId} className={currentTab !== tabId ? 'hidden' : ''}>
                {renderTab(tabId)}
              </div>
            );
          })}
        </Suspense>
      );
  };

  return (
    <div className="w-full">
        {renderContent()}

        <EmployeeModal 
            show={showEmployeeModal} 
            onClose={() => setShowEmployeeModal(false)} 
            onSubmit={addOrUpdateEmployee}
            onResetPassword={resetEmployeePassword}
            onAdminSetPassword={adminSetPassword}
            employeeData={editingItem}
        />
        
        <EmployeeExportPdfModal 
            show={showExportPdfModal}
            onClose={() => setShowExportPdfModal(false)}
            employees={filteredEmployees}
            showArchived={showArchived}
            onGenerate={handleExportEmployeesPDF}
        />
        
        <EmployeeRecordModal 
            show={showRecordModal} 
            onClose={() => { setShowRecordModal(false); setViewingEmployee(null); }} 
            employee={viewingEmployee} 
            absenceRecords={absenceRecords}
            payStubs={payStubs}
        />

        <AbsenceModal 
            show={showAbsenceModal} 
            onClose={() => { setShowAbsenceModal(false); setEditingItem(null); }} 
            onSubmit={addOrUpdateAbsence} 
            employees={activeEmployees} 
            absenceData={editingItem}
            currentUser={currentUser}
        />
        <PaystubModal 
            show={showPaystubModal} 
            onClose={() => { setShowPaystubModal(false); setEditingPayStub(null); }} 
            onSubmit={addOrUpdatePayStub} 
            employees={activeEmployees} 
            currentUser={currentUser} 
            payStubs={payStubs} 
            payStubToEdit={editingPayStub}
            automaticAdjustments={automaticAdjustments || []}
            updateEmployee={addOrUpdateEmployee}
        />
        
        <ConfirmModal 
          show={safetyGuard.show}
          onClose={() => setSafetyGuard(prev => ({ ...prev, show: false }))}
          onConfirm={safetyGuard.onConfirm}
          title={safetyGuard.title}
          description={safetyGuard.description}
          isLoading={safetyGuard.isLoading}
          icon={safetyGuard.icon}
        />
    </div>
  );
};
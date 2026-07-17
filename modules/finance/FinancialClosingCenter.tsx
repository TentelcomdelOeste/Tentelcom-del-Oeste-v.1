
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCashflow } from '../../hooks/useCashflow';
import { useInvoices } from '../finance/invoices/useInvoices';
import { useMonthlyClosing } from '../../hooks/useMonthlyClosing';
import { User } from '../../utils/types';
import { formatCurrency } from '../../utils/formatCurrency';
import { MonthlySnapshotService } from '../../services/monthlySnapshot.service';
import { useConfirm } from '../../design-system';
import { FiLock, FiSlash, FiCheck, FiArrowRight, FiInfo, FiLoader, FiAlertTriangle, FiBriefcase, FiList, FiFileText, FiShield, FiX, FiChevronRight } from "react-icons/fi";

interface FinancialClosingCenterProps {
  currentUser: User;
  onNavigateToDetail?: () => void;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const FinancialClosingCenter: React.FC<FinancialClosingCenterProps> = ({ currentUser, onNavigateToDetail }) => {
  // 1. Data Hooks
  const { entries } = useCashflow(currentUser);
  const { invoices } = useInvoices(currentUser);
  const { isDateClosed, closings } = useMonthlyClosing(currentUser);
  const confirm = useConfirm();

  // 2. Local State
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // Default current month
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 3. Derived State: Month Status
  const periodKey = `${selectedYear}-${selectedMonth}`;
  const isClosed = isDateClosed(`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`);
  
  // 4. Data Filtering & Aggregation (Strict Multi-Currency)
  const periodData = useMemo(() => {
    const targetEntries = entries.filter(e => {
        const [eYear, eMonth] = e.date.split('-').map(Number);
        return eYear === selectedYear && eMonth === selectedMonth;
    });

    const targetInvoices = invoices.filter(inv => {
        const [iYear, iMonth] = inv.issueDate.split('-').map(Number);
        return iYear === selectedYear && iMonth === selectedMonth;
    });

    // Aggregation Buckets
    const crc = { income: 0, expenses: 0, net: 0 };
    const usd = { income: 0, expenses: 0, net: 0 };
    let uncategorizedCount = 0;
    let movementsWithoutProject = 0;
    const projectBalances: Record<string, number> = {};

    targetEntries.forEach(e => {
        const val = e.amount;
        // Validation Checks
        if (e.type === 'Egreso' && !e.subtype) uncategorizedCount++;
        if (!e.projectId) movementsWithoutProject++;

        // Project Balance Check (Simplificado: Suma algebraica global para detectar rojos)
        if (e.projectId) {
            const impact = e.type === 'Ingreso' ? val : -val;
            projectBalances[e.projectId] = (projectBalances[e.projectId] || 0) + impact;
        }

        if (e.currency === 'USD') {
            if (e.type === 'Ingreso') usd.income += val;
            else usd.expenses += val;
        } else {
            if (e.type === 'Ingreso') crc.income += val;
            else crc.expenses += val;
        }
    });

    // Net Calculations
    crc.net = crc.income - crc.expenses;
    usd.net = usd.income - usd.expenses;

    // Count projects with negative balance
    const negativeProjectsCount = Object.values(projectBalances).filter(balance => balance < 0).length;

    return { 
        crc, 
        usd, 
        entries: targetEntries, 
        invoices: targetInvoices,
        uncategorizedCount,
        movementsWithoutProject,
        negativeProjectsCount
    };
  }, [entries, invoices, selectedYear, selectedMonth]);

  // 5. Validations Logic & Risk Calculation
  const validations = useMemo(() => {
      const hasMovements = periodData.entries.length > 0;
      const allCategorized = periodData.uncategorizedCount === 0;
      const pendingInvoices = periodData.invoices.filter(i => i.status === 'Pendiente').length;
      
      // --- CÁLCULO DE RIESGO AVANZADO ---
      const riskReasons: string[] = [];

      if (pendingInvoices > 0) {
         riskReasons.push(`${pendingInvoices} facturas pendientes de cobro/pago`);
      }

      if (!allCategorized) {
         riskReasons.push(`${periodData.uncategorizedCount} movimientos sin categorizar`);
      }

      if (periodData.movementsWithoutProject > 0) {
         riskReasons.push(`${periodData.movementsWithoutProject} movimientos sin proyecto asignado`);
      }

      if (periodData.negativeProjectsCount > 0) {
         riskReasons.push(`${periodData.negativeProjectsCount} proyectos con utilidad negativa`);
      }

      let risk: 'Bajo' | 'Medio' | 'Alto' = 'Bajo';

      if (riskReasons.length >= 2) risk = 'Medio';
      
      // Reglas de Alto Riesgo (Bloqueantes)
      if (!allCategorized || periodData.movementsWithoutProject > 0) risk = 'Alto';

      // Bloqueo del botón de cierre
      // Se bloquea si no hay movimientos, si ya está cerrado, o si el riesgo es ALTO (Integridad de datos)
      const isBlocked = !hasMovements || isClosed || risk === 'Alto';

      return {
          hasMovements,
          allCategorized,
          pendingInvoices,
          isBlocked,
          risk,
          riskReasons
      };
  }, [periodData, isClosed]);

  // 6. Actions
  const handleExecuteClose = async () => {
      setIsProcessing(true);
      try {
          await MonthlySnapshotService.createMonthlySnapshot(selectedYear, selectedMonth, currentUser.email);
          setShowConfirmModal(false);
      } catch (error: any) {
          await confirm({
              title: "Error Crítico",
              description: "Error al cerrar periodo: " + error.message,
              confirmLabel: "Cerrar",
              variant: "danger"
          });
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4">
      
      {/* 1️⃣ HEADER CORPORATIVO */}
      <div className="bg-white rounded-t-3xl border-x border-t border-slate-200 p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">
                Centro de Cierre Financiero
            </h1>
            <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <select 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-transparent text-sm font-bold text-slate-700 py-1 px-3 outline-none cursor-pointer"
                        disabled={isProcessing}
                    >
                        {monthNames.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <div className="w-px bg-slate-300 my-1"></div>
                    <select 
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent text-sm font-bold text-slate-700 py-1 px-3 outline-none cursor-pointer"
                        disabled={isProcessing}
                    >
                        {[2023, 2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                {/* Status Badge */}
                {isClosed ? (
                    <span className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <FiLock  /> Periodo Cerrado
                    </span>
                ) : validations.isBlocked ? (
                    <span className="bg-red-50 text-red-700 border border-red-200 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <FiSlash  /> Cierre Bloqueado
                    </span>
                ) : (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <FiCheck  /> Listo para Cierre
                    </span>
                )}
            </div>
        </div>

        {onNavigateToDetail && (
            <button 
                onClick={onNavigateToDetail}
                className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wide border-b border-transparent hover:border-blue-600 transition-all pb-0.5"
            >
                Ver análisis detallado <FiArrowRight className="ml-1"  />
            </button>
        )}
      </div>

      <div className="bg-white border-x border-b border-slate-200 p-8 rounded-b-3xl space-y-8">
        
        {/* 2️⃣ EXECUTIVE SUMMARY & RISK ANALYSIS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard 
                label="Flujo Neto Combinado" 
                value="N/A" 
                subtext="Requiere consolidación manual" 
                icon={<FiBriefcase />}
                variant="neutral"
            />
            <SummaryCard 
                label="Movimientos Totales" 
                value={periodData.entries.length.toString()} 
                subtext="Transacciones registradas" 
                icon={<FiList />}
                variant="blue"
            />
            <SummaryCard 
                label="Facturas Emitidas" 
                value={periodData.invoices.length.toString()} 
                subtext={`${validations.pendingInvoices} pendientes de pago`} 
                icon={<FiFileText />}
                variant="indigo"
            />
            
            {/* CARD DE RIESGO MEJORADO */}
            <div className={`
                border rounded-2xl p-5 flex flex-col justify-between h-auto min-h-[8rem] transition-all relative overflow-hidden
                ${validations.risk === 'Alto' 
                    ? 'bg-red-50 border-red-200' 
                    : validations.risk === 'Medio' 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-emerald-50 border-emerald-200'}
            `}>
                <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                        validations.risk === 'Alto' ? 'text-red-800' : validations.risk === 'Medio' ? 'text-amber-800' : 'text-emerald-800'
                    }`}>Riesgo del Cierre: {validations.risk}</span>
                    <div className={`opacity-80 ${
                        validations.risk === 'Alto' ? 'text-red-600' : validations.risk === 'Medio' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                        {validations.risk === 'Alto' ? <FiAlertTriangle /> : validations.risk === 'Medio' ? <FiInfo /> : <FiShield />}
                    </div>
                </div>

                {validations.riskReasons.length > 0 ? (
                    <div className="space-y-1.5 mt-1 overflow-y-auto max-h-24 custom-scrollbar">
                        {validations.riskReasons.map((reason, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                                <FiChevronRight className={`text-[10px] mt-[3px] ${
                                    validations.risk === 'Alto' ? 'text-red-500' : 'text-amber-500'
                                }`} />
                                <span className={`text-[10px] font-bold leading-tight ${
                                    validations.risk === 'Alto' ? 'text-red-700' : 'text-amber-700'
                                }`}>{reason}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mt-2">
                        <FiCheck className="text-emerald-600 text-xs"  />
                        <span className="text-[10px] font-bold text-emerald-700">Integridad de datos verificada.</span>
                    </div>
                )}
            </div>
        </div>

        {/* 3️⃣ BLOQUE MULTIMONEDA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* COLONES */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">CRC</div>
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Resultados en Colones</h3>
                    </div>
                    {periodData.crc.net < 0 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded">Déficit Operativo</span>}
                </div>
                <div className="space-y-4">
                    <CurrencyRow label="Ingresos Operativos" value={periodData.crc.income} currency="CRC" type="income" />
                    <CurrencyRow label="Egresos Operativos" value={periodData.crc.expenses} currency="CRC" type="expense" />
                    <div className="h-px bg-slate-200 my-2"></div>
                    <CurrencyRow label="Utilidad Neta" value={periodData.crc.net} currency="CRC" type="net" isBold />
                </div>
            </div>

            {/* DÓLARES */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">USD</div>
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Resultados en Dólares</h3>
                    </div>
                    {periodData.usd.net < 0 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded">Déficit Operativo</span>}
                </div>
                <div className="space-y-4">
                    <CurrencyRow label="Ingresos Operativos" value={periodData.usd.income} currency="USD" type="income" />
                    <CurrencyRow label="Egresos Operativos" value={periodData.usd.expenses} currency="USD" type="expense" />
                    <div className="h-px bg-slate-200 my-2"></div>
                    <CurrencyRow label="Utilidad Neta" value={periodData.usd.net} currency="USD" type="net" isBold />
                </div>
            </div>
        </div>

        {/* 4️⃣, 5️⃣, 6️⃣, 7️⃣ VALIDACIONES Y SNAPSHOT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Panel de Validaciones */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Validaciones del Sistema</h4>
                <div className="space-y-4">
                    <ValidationItem 
                        label="Existencia de movimientos en el período" 
                        status={validations.hasMovements} 
                        errorMsg="No hay movimientos registrados para cerrar."
                    />
                    <ValidationItem 
                        label="Categorización completa de egresos" 
                        status={validations.allCategorized} 
                        errorMsg={`${periodData.uncategorizedCount} movimientos sin categoría asignada.`}
                    />
                    <ValidationItem 
                        label="Asignación de Proyectos" 
                        status={periodData.movementsWithoutProject === 0} 
                        warning={periodData.movementsWithoutProject > 0 ? `${periodData.movementsWithoutProject} movimientos huérfanos (sin proyecto).` : undefined}
                    />
                    <ValidationItem 
                        label="Integridad de cierre previo" 
                        status={!isClosed} 
                        errorMsg="El período ya se encuentra cerrado."
                    />
                </div>
            </div>

            {/* Snapshot Preview & Action */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Proceso de Cierre</h4>
                    <div className="space-y-3 mb-8">
                        <CheckStep label="Validación documental" done={!validations.isBlocked} />
                        <CheckStep label="Consolidación financiera" done={!validations.isBlocked} />
                        <CheckStep label="Generación de Snapshot" done={false} />
                        <CheckStep label="Bloqueo de escritura" done={false} />
                    </div>
                    
                    <div className="bg-blue-100/50 p-4 rounded-xl border border-blue-200 mb-6">
                        <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                            <FiInfo className="mr-1"  /> Al ejecutar el cierre se generará un <span className="font-black">SNAPSHOT INMUTABLE</span> con el balance actual.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={validations.isBlocked || isClosed}
                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        validations.isBlocked || isClosed
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-300'
                    }`}
                >
                    {isClosed ? <><FiLock  /> Período Cerrado</> : validations.isBlocked ? <><FiSlash  /> Cierre Bloqueado</> : 'Ejecutar Cierre Contable'}
                </button>
            </div>
        </div>

      </div>

      {/* 9️⃣ CONFIRMATION MODAL */}
      {showConfirmModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex justify-center items-center z-[999] p-4">
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200 border-t-8 border-red-600">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                    <FiLock className="text-3xl"  />
                </div>
                
                <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Confirmar Cierre Contable</h2>
                <p className="text-sm font-medium text-slate-500 mb-8 px-4 leading-relaxed">
                    Está a punto de cerrar el período <span className="text-slate-900 font-bold">{monthNames[selectedMonth - 1]} {selectedYear}</span>.
                    <br/><br/>
                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded font-bold text-xs border border-red-100">
                        ESTE PROCESO ES IRREVERSIBLE
                    </span>
                    <br/><br/>
                    El período será bloqueado y no podrán realizarse modificaciones, eliminaciones ni ediciones de documentos.
                </p>

                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowConfirmModal(false)}
                        disabled={isProcessing}
                        className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold text-xs uppercase rounded-xl hover:bg-slate-200 transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleExecuteClose}
                        disabled={isProcessing}
                        className="flex-1 py-4 bg-red-600 text-white font-black text-xs uppercase rounded-xl hover:bg-red-700 transition-all shadow-xl shadow-red-100 active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <FiLoader className="animate-spin" /> : <FiCheck />}
                        {isProcessing ? 'Procesando...' : 'CONFIRMAR'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}

    </div>
  );
};

// --- SUBCOMPONENTS (Internal for Isolation) ---

const SummaryCard = ({ label, value, subtext, icon, variant }: any) => {
    const colors: any = {
        neutral: "text-slate-600",
        blue: "text-blue-600",
        indigo: "text-indigo-600",
        emerald: "text-emerald-600",
        amber: "text-amber-600",
        rose: "text-rose-600"
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between h-auto min-h-[8rem] hover:border-slate-300 transition-all">
            <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                <div className={`${colors[variant]} opacity-80`}>{icon}</div>
            </div>
            <div>
                <p className={`text-2xl font-black ${colors[variant]} tracking-tight`}>{value}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">{subtext}</p>
            </div>
        </div>
    );
};

const CurrencyRow = ({ label, value, currency, type, isBold = false }: any) => {
    const color = type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-red-600' : value >= 0 ? 'text-blue-700' : 'text-rose-700';
    
    return (
        <div className="flex justify-between items-center">
            <span className={`text-xs ${isBold ? 'font-black text-slate-800' : 'font-bold text-slate-500'} uppercase`}>{label}</span>
            <span className={`font-mono ${isBold ? 'text-lg font-black' : 'text-sm font-bold'} ${color}`}>
                {formatCurrency(value, currency)}
            </span>
        </div>
    );
};

const ValidationItem = ({ label, status, errorMsg, warning }: any) => {
    return (
        <div className="flex items-start gap-4 p-3 rounded-xl border border-transparent hover:bg-slate-50 transition-colors">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-none text-xs ${status ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {status ? <FiCheck /> : <FiX />}
            </div>
            <div>
                <p className={`text-xs font-bold ${status ? 'text-slate-700' : 'text-red-700'}`}>{label}</p>
                {!status && errorMsg && <p className="text-[10px] font-medium text-red-500 mt-0.5">{errorMsg}</p>}
                {status && warning && <p className="text-[10px] font-bold text-amber-600 mt-0.5"><FiAlertTriangle className="mr-1"  />{warning}</p>}
            </div>
        </div>
    );
};

const CheckStep = ({ label, done }: any) => (
    <div className="flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
        <span className={`text-xs font-bold ${done ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{label}</span>
    </div>
);

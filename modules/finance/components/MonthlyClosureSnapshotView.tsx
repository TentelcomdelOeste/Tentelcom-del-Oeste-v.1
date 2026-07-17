
import React from 'react';
import { MonthlyClosing } from '../../../cashflowTypes';
import { formatCurrency } from '../../../utils/formatCurrency';
import { FiLock, FiArrowLeft, FiTrendingUp, FiTrendingDown, FiBriefcase, FiShield } from "react-icons/fi";

interface Props {
  snapshot: MonthlyClosing;
  onBack: () => void;
}

export const MonthlyClosureSnapshotView: React.FC<Props> = ({ snapshot, onBack }) => {
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 flex justify-between items-center">
        <div>
            <div className="flex items-center gap-3 mb-1">
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200 shadow-sm">
                    <FiLock className="mr-1"  /> Mes Cerrado
                </span>
                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                    {snapshot.year}
                </span>
            </div>
            <h2 className="text-2xl font-black text-blue-950 uppercase tracking-tight">
                {monthNames[snapshot.month - 1]}
            </h2>
        </div>
        <button 
            onClick={onBack}
            className="bg-white border border-slate-200 text-slate-500 hover:text-blue-600 px-4 py-2 rounded-xl font-bold text-xs uppercase transition-all shadow-sm hover:shadow-md"
        >
            <FiArrowLeft className="mr-2"  /> Volver
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl relative overflow-hidden shadow-sm">
            <FiTrendingUp className="absolute -right-4 -bottom-4 text-8xl text-emerald-100 opacity-50"  />
            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-2 relative z-10">Ingresos Totales (CRC)</p>
            <p className="text-3xl font-black text-emerald-600 relative z-10">{formatCurrency(snapshot.totalIncome, 'CRC')}</p>
         </div>

         <div className="bg-red-50 border border-red-100 p-6 rounded-2xl relative overflow-hidden shadow-sm">
            <FiTrendingDown className="absolute -right-4 -bottom-4 text-8xl text-red-100 opacity-50"  />
            <p className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-2 relative z-10">Egresos Totales (CRC)</p>
            <p className="text-3xl font-black text-red-600 relative z-10">{formatCurrency(snapshot.totalExpenses, 'CRC')}</p>
         </div>

         <div className={`border p-6 rounded-2xl relative overflow-hidden shadow-sm ${snapshot.netResult >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
            <FiBriefcase className="absolute -right-4 -bottom-4 text-8xl opacity-10"  />
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 relative z-10 ${snapshot.netResult >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Resultado Neto (CRC)</p>
            <p className={`text-3xl font-black relative z-10 ${snapshot.netResult >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(snapshot.netResult, 'CRC')}</p>
         </div>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-300 shadow-sm border border-slate-100">
                <FiShield className="text-xl"  />
            </div>
            <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Snapshot de Seguridad</p>
                <p className="text-[10px] text-slate-500 font-medium max-w-md mt-1">Este reporte fue generado automáticamente al cerrar el periodo. Los montos son inmutables y sirven como evidencia financiera para auditoría.</p>
            </div>
         </div>
         
         <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cerrado por</p>
            <p className="text-xs font-black text-slate-600">{snapshot.closedBy}</p>
            <p className="text-[9px] font-mono text-slate-400 mt-1">{new Date(snapshot.closedAt).toLocaleString()}</p>
         </div>
      </div>
    </div>
  );
};

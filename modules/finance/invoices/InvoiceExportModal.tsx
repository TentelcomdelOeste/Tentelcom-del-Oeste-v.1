
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { exportFullInvoicesToExcel } from '../../../utils/export/exportInvoicesExcel';
import { exportFullInvoicesToPDF } from '../../../utils/export/exportInvoicesPDF';
import { useConfirm } from '../../../design-system';
import { FiX, FiLoader, FiFile, FiFileText } from "react-icons/fi";

interface InvoiceExportModalProps {
  show: boolean;
  onClose: () => void;
  availableYears: string[];
}

export const InvoiceExportModal: React.FC<InvoiceExportModalProps> = ({ show, onClose, availableYears }) => {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [month, setMonth] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [paymentMode, setPaymentMode] = useState<string>('all');
  const [currency, setCurrency] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const confirm = useConfirm();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  if (!show) return null;

  const handleExport = async (format: 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      const filters = {
        year,
        month,
        type,
        paymentMode,
        currency
      };

      if (format === 'excel') {
        await exportFullInvoicesToExcel(filters);
      } else {
        await exportFullInvoicesToPDF(filters);
      }
      // No cerramos el modal automáticamente para permitir múltiples exportaciones si se desea
    } catch (error) {
      console.error("Error en exportación:", error);
      await confirm({
          title: "Error de Exportación",
          description: "Hubo un error al generar el archivo. Por favor intente nuevamente.",
          confirmLabel: "Cerrar",
          variant: "warning"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Exportar Reporte</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configuración de descarga</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm border border-slate-100"
          >
            <FiX  />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          
          {/* Fila 1: Periodo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Año</label>
              <select 
                value={year} 
                onChange={e => setYear(e.target.value)} 
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
              >
                <option value="all">Todos</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mes</label>
              <select 
                value={month} 
                onChange={e => setMonth(e.target.value)} 
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
              >
                <option value="all">Todos</option>
                {monthNames.map((m, i) => <option key={m} value={(i+1).toString()}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="h-px bg-slate-100"></div>

          {/* Fila 2: Filtros Financieros */}
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo de Factura</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setType('all')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${type === 'all' ? 'bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >Todas</button>
                <button 
                  onClick={() => setType('CXC')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${type === 'CXC' ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >Cobrar</button>
                <button 
                  onClick={() => setType('CXP')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${type === 'CXP' ? 'bg-red-100 text-red-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >Pagar</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Modalidad</label>
                <select 
                  value={paymentMode} 
                  onChange={e => setPaymentMode(e.target.value)} 
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  <option value="all">Todas</option>
                  <option value="CONTADO">Contado</option>
                  <option value="CREDITO">Crédito</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Moneda</label>
                <select 
                  value={currency} 
                  onChange={e => setCurrency(e.target.value)} 
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  <option value="all">Todas</option>
                  <option value="CRC">Colones (CRC)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex gap-3">
            <button 
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="flex-1 py-3 bg-emerald-600 text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <FiLoader className="animate-spin"  /> : <FiFile  />}
              Exportar Excel
            </button>
            <button 
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="flex-1 py-3 bg-red-600 text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <FiLoader className="animate-spin"  /> : <FiFileText  />}
              Exportar PDF
            </button>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-2 text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 transition-colors"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

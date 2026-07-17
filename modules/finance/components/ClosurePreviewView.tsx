import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CashflowEntry } from '../../../cashflowTypes';
import { formatCurrency } from '../../../utils/formatCurrency';
import { FiActivity, FiX, FiMonitor, FiDatabase } from "react-icons/fi";

interface ClosurePreviewViewProps {
  year: number;
  month: number;
  allEntries: CashflowEntry[];
  onClose: () => void;
}

interface CurrencyStats {
    income: number;
    expenses: number;
    net: number;
    count: number;
}

export const ClosurePreviewView: React.FC<ClosurePreviewViewProps> = ({ year, month, allEntries, onClose }) => {
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  // Estados para consolidación opcional
  const [isConsolidated, setIsConsolidated] = useState(false);
  const [manualExchangeRate, setManualExchangeRate] = useState<string>('');

  // 1. Cálculo Multi-Moneda Independiente
  const { statsCRC, statsUSD } = useMemo(() => {
    const targetEntries = allEntries.filter(e => {
        const [eYear, eMonth] = e.date.split('-').map(Number);
        return eYear === year && eMonth === month;
    });

    const crc: CurrencyStats = { income: 0, expenses: 0, net: 0, count: 0 };
    const usd: CurrencyStats = { income: 0, expenses: 0, net: 0, count: 0 };

    targetEntries.forEach(curr => {
        const amount = Number(curr.amount) || 0;
        
        if (curr.currency === 'USD') {
            if (curr.type === 'Ingreso') usd.income += amount;
            else usd.expenses += amount;
            usd.count++;
        } else {
            // Default to CRC
            if (curr.type === 'Ingreso') crc.income += amount;
            else crc.expenses += amount;
            crc.count++;
        }
    });

    crc.net = crc.income - crc.expenses;
    usd.net = usd.income - usd.expenses;

    return { statsCRC: crc, statsUSD: usd };

  }, [allEntries, year, month]);

  // 2. Cálculo Consolidado (Solo si el usuario lo activa y provee tasa)
  const consolidatedStats = useMemo(() => {
      if (!isConsolidated) return null;
      
      const rate = parseFloat(manualExchangeRate);
      if (isNaN(rate) || rate <= 0) return null;

      // Consolidación a Moneda Base (CRC)
      return {
          income: statsCRC.income + (statsUSD.income * rate),
          expenses: statsCRC.expenses + (statsUSD.expenses * rate),
          net: statsCRC.net + (statsUSD.net * rate),
          count: statsCRC.count + statsUSD.count
      };
  }, [statsCRC, statsUSD, isConsolidated, manualExchangeRate]);

  // Renderizado de Tarjeta Financiera
  const FinancialCard = ({ title, income, expenses, net, currency, count }: { title: string, income: number, expenses: number, net: number, currency: 'USD' | 'CRC', count: number }) => (
      <div className={`p-5 rounded-2xl border mb-4 relative overflow-hidden ${currency === 'USD' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${currency === 'USD' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                      {currency}
                  </div>
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title}</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-full shadow-sm">
                  {count} movs.
              </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ingresos</p>
                  <p className="text-lg font-black text-emerald-600">{formatCurrency(income, currency)}</p>
              </div>
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Egresos</p>
                  <p className="text-lg font-black text-red-500">{formatCurrency(expenses, currency)}</p>
              </div>
              <div className={`pl-4 border-l ${currency === 'USD' ? 'border-indigo-200' : 'border-slate-200'}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Balance</p>
                  <p className={`text-lg font-black ${net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrency(net, currency)}
                  </p>
              </div>
          </div>
      </div>
  );

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-none">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200 shadow-sm">
                        <FiActivity className="mr-1"  /> Simulación
                    </span>
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                        {year}
                    </span>
                </div>
                <h2 className="text-2xl font-black text-blue-950 uppercase tracking-tight">
                    Pre-Cierre: {monthNames[month - 1]}
                </h2>
            </div>
            <button 
                onClick={onClose} 
                className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all shadow-sm border border-slate-100"
            >
                <FiX className="text-lg"  />
            </button>
        </div>

        {/* Toolbar de Consolidación (Nivel ERP) */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 flex-none">
            <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                    <input 
                        type="checkbox" 
                        checked={isConsolidated} 
                        onChange={(e) => {
                            setIsConsolidated(e.target.checked);
                            if (!e.target.checked) setManualExchangeRate('');
                        }} 
                        className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <span className={`text-xs font-black uppercase tracking-wide ${isConsolidated ? 'text-blue-700' : 'text-slate-400'}`}>Vista Consolidada (CRC)</span>
            </label>

            {isConsolidated && (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4 fade-in">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">T.C. Manual:</span>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₡</span>
                        <input 
                            type="number" 
                            placeholder="0.00" 
                            value={manualExchangeRate}
                            onChange={(e) => setManualExchangeRate(e.target.value)}
                            className="w-28 pl-6 pr-2 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-200"
                            autoFocus
                        />
                    </div>
                </div>
            )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-white flex-1">
            
            {/* Disclaimer para Consolidación */}
            {isConsolidated && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 items-start mb-6 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 flex-none">
                        <FiMonitor className="text-sm"  />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-amber-800 uppercase tracking-tight">Conversión Informativa</h4>
                        <p className="text-[10px] font-medium text-amber-700 mt-1 leading-relaxed">
                            Esta vista convierte los montos en USD a CRC utilizando la tasa manual de <span className="font-bold">₡{manualExchangeRate || '---'}</span>. 
                            Esto es solo para efectos de visualización y <span className="underline">no genera asientos contables</span> de diferencial cambiario.
                        </p>
                    </div>
                </div>
            )}

            {/* VISTAS FINANCIERAS */}
            {isConsolidated ? (
                // --- VISTA CONSOLIDADA ---
                consolidatedStats ? (
                    <FinancialCard 
                        title="Resumen Consolidado (Estimado)" 
                        income={consolidatedStats.income}
                        expenses={consolidatedStats.expenses}
                        net={consolidatedStats.net}
                        currency="CRC"
                        count={consolidatedStats.count}
                    />
                ) : (
                    <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                        <FiDatabase className="text-slate-300 text-3xl mb-3"  />
                        <p className="text-xs font-bold text-slate-400 uppercase">Ingrese una Tasa de Cambio válida para consolidar.</p>
                    </div>
                )
            ) : (
                // --- VISTA MULTI-MONEDA REAL (DEFAULT) ---
                <div className="space-y-2">
                    {/* Bloque Colones */}
                    {statsCRC.count > 0 ? (
                        <FinancialCard 
                            title="Operaciones en Colones" 
                            income={statsCRC.income}
                            expenses={statsCRC.expenses}
                            net={statsCRC.net}
                            currency="CRC"
                            count={statsCRC.count}
                        />
                    ) : (
                        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-center text-xs text-slate-400 font-bold mb-4">
                            No hay movimientos en Colones (CRC)
                        </div>
                    )}

                    {/* Bloque Dólares */}
                    {statsUSD.count > 0 ? (
                        <FinancialCard 
                            title="Operaciones en Dólares" 
                            income={statsUSD.income}
                            expenses={statsUSD.expenses}
                            net={statsUSD.net}
                            currency="USD"
                            count={statsUSD.count}
                        />
                    ) : (
                        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-center text-xs text-slate-400 font-bold">
                            No hay movimientos en Dólares (USD)
                        </div>
                    )}
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
                onClick={onClose}
                className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 px-6 py-3 rounded-xl font-black text-xs uppercase transition-all shadow-sm hover:shadow-md hover:bg-slate-50"
            >
                Cerrar Preview
            </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
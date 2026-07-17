import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrder } from './types';
import { useAuditPermanence } from '@/hooks/useAuditPermanence';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';
import { FiX } from "react-icons/fi";

interface PurchaseOrderModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: PurchaseOrder | null;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({ show, onClose, onSubmit, initialData }) => {
  useAuditPermanence({
    module: 'Finanzas',
    submodule: initialData ? 'Editar Orden de Compra' : 'Nueva Orden de Compra',
    recordId: initialData?.id,
    recordCode: initialData?.ocNumber,
    enabled: show
  });
  useLockBodyScroll(show);

  const [formData, setFormData] = useState({
    provider: '',
    ocNumber: '',
    totalAmount: '',
    currency: 'USD',
    issueDate: new Date().toISOString().split('T')[0],
    description: '',
    status: 'ABIERTA'
  });

  useEffect(() => {
    if (show) {
      if (initialData) {
        setFormData({
          provider: initialData.provider,
          ocNumber: initialData.ocNumber,
          totalAmount: initialData.totalAmount.toString(),
          currency: initialData.currency,
          issueDate: initialData.issueDate,
          description: initialData.description || '',
          status: initialData.status
        });
      } else {
        setFormData({
          provider: '',
          ocNumber: '',
          totalAmount: '',
          currency: 'USD',
          issueDate: new Date().toISOString().split('T')[0],
          description: '',
          status: 'ABIERTA'
        });
      }
    }
  }, [show, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      ...formData,
      totalAmount: parseFloat(formData.totalAmount)
    });
    onClose();
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
            {initialData ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <FiX className="text-xl"  />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Proveedor</label>
            <input 
              type="text" 
              required
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              value={formData.provider}
              onChange={e => setFormData({...formData, provider: e.target.value})}
              placeholder="Nombre del Proveedor"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1"># Orden Compra</label>
              <input 
                type="text" 
                required
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                value={formData.ocNumber}
                onChange={e => setFormData({...formData, ocNumber: e.target.value})}
                placeholder="OC-001"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha Emisión</label>
              <input 
                type="date" 
                required
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                value={formData.issueDate}
                onChange={e => setFormData({...formData, issueDate: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Moneda</label>
              <select 
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                value={formData.currency}
                onChange={e => setFormData({...formData, currency: e.target.value})}
              >
                <option value="USD">USD ($)</option>
                <option value="CRC">CRC (¢)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Monto Total</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                required
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                value={formData.totalAmount}
                onChange={e => setFormData({...formData, totalAmount: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Estado</label>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setFormData({...formData, status: 'ABIERTA'})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${formData.status === 'ABIERTA' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500' : 'bg-slate-50 text-slate-400'}`}
                >
                    Abierta
                </button>
                <button
                    type="button"
                    onClick={() => setFormData({...formData, status: 'CERRADA'})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${formData.status === 'CERRADA' ? 'bg-slate-200 text-slate-600 ring-2 ring-slate-400' : 'bg-slate-50 text-slate-400'}`}
                >
                    Cerrada
                </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Descripción</label>
            <textarea 
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 h-24 resize-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Detalles adicionales..."
            />
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs hover:bg-slate-100 rounded-xl transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} className="flex-1 py-3 bg-blue-600 text-white font-black uppercase text-xs rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
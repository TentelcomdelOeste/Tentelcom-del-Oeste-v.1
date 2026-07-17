import React, { useState, useMemo } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { InventoryItem } from '../../inventoryTypes';

interface MaterialSelectorModalProps {
  show: boolean;
  onClose: () => void;
  onSelect: (item: InventoryItem) => void;
  inventoryItems: InventoryItem[];
}

export const MaterialSelectorModal: React.FC<MaterialSelectorModalProps> = ({
  show,
  onClose,
  onSelect,
  inventoryItems
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchTerm) return inventoryItems.slice(0, 50);
    const term = searchTerm.toLowerCase();
    return inventoryItems.filter(i => 
      i.code.toLowerCase().includes(term) || 
      i.description.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [inventoryItems, searchTerm]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-black text-blue-900 uppercase tracking-tight">Seleccionar Material</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <FiX className="text-slate-500" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              className="p-4 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors rounded-xl flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-blue-600 uppercase">{item.code}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
                    Disponible: {item.stock}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800 truncate">{item.description}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</p>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <p className="p-8 text-center text-sm font-bold text-slate-400">No se encontraron materiales.</p>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Client } from '../../types';
import { FiX, FiSearch, FiTrash2, FiCheck } from "react-icons/fi";
import { ActionButton, IconButton } from '../../design-system';
import useLockBodyScroll from '../../hooks/useLockBodyScroll';

interface ClientDirectoryModalProps {
  show: boolean;
  onClose: () => void;
  clients: Client[];
  onSelect: (client: Client) => void;
  onDelete?: (e: React.MouseEvent, client: Client) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export const ClientDirectoryModal: React.FC<ClientDirectoryModalProps> = ({ 
  show, 
  onClose, 
  clients, 
  onSelect,
  onDelete,
  hasMore,
  onLoadMore,
  isLoadingMore
}) => {
  const [clientSearch, setClientSearch] = useState('');
  useLockBodyScroll(show);

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm z-[700] flex justify-center items-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6 flex-none">
                <div>
                    <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Directorio Corporativo</span>
                    <h3 className="text-3xl font-black text-blue-950 uppercase tracking-tight">Directorio de Clientes</h3>
                </div>
                <IconButton 
                    onClick={onClose} 
                    icon={<FiX />}
                    variant="ghost"
                    size="md"
                    className="hover:text-red-500 hover:bg-red-50"
                />
            </div>
            
            <div className="relative mb-6 flex-none">
                <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"  />
                <input 
                    type="text" 
                    placeholder="Filtrar por empresa, contacto o código..." 
                    value={clientSearch} 
                    onChange={e => setClientSearch(e.target.value)} 
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-400" 
                    autoFocus 
                />
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-3">
                {clients
                .filter(c => 
                    (c.isActive !== false) && (
                    c.empresa.toLowerCase().includes(clientSearch.toLowerCase()) || 
                    c.contacto.toLowerCase().includes(clientSearch.toLowerCase()) ||
                    (c.codigoCliente && c.codigoCliente.toLowerCase().includes(clientSearch.toLowerCase()))
                    )
                )
                .map((client, index) => (
                    <div key={client.id} className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:border-blue-300 transition-all bg-white group shadow-sm hover:shadow-md">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-400 flex-none">
                                #{index + 1}
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-400 mb-1 block uppercase tracking-wider">{client.codigoCliente || 'S/C'}</span>
                                <h4 className="text-lg font-black text-blue-950 leading-none mb-1">{client.empresa}</h4>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">ATENCIÓN: {client.contacto}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {onDelete && (
                                <IconButton 
                                    onClick={(e) => onDelete(e, client)}
                                    icon={<FiTrash2 />}
                                    variant="danger"
                                    size="md"
                                    title="Eliminar Cliente"
                                />
                            )}
                            <IconButton 
                                onClick={() => onSelect(client)}
                                icon={<FiCheck />}
                                variant="primary"
                                size="md"
                                title="Seleccionar Cliente"
                            />
                        </div>
                    </div>
                ))}
                
                {isLoadingMore && (
                    <div className="py-4 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        Cargando más...
                    </div>
                )}

                {!isLoadingMore && hasMore && (
                    <div className="py-4">
                        <ActionButton 
                            onClick={onLoadMore}
                            label="Cargar más clientes"
                            variant="secondary"
                            className="w-full"
                        />
                    </div>
                )}

                {clients.filter(c => c.isActive !== false).length === 0 && !isLoadingMore && (
                    <div className="text-center py-10 text-slate-400 font-bold">
                        No hay clientes registrados.
                    </div>
                )}
            </div>
        </div>
    </div>,
    document.body
  );
};

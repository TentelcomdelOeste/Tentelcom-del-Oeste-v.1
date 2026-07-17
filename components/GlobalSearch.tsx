import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiFileText, FiUsers, FiBox, FiDollarSign, FiX, FiClipboard } from 'react-icons/fi';
import { useQuotes } from '../hooks/useQuotes';
import { useInventory } from '../hooks/useInventory';
import { useClients } from '../hooks/useClients';
import { useCashflow } from '../hooks/useCashflow';
import { useMaterialRequests } from '../hooks/useMaterialRequests';
import { User } from '../utils/types';
import { IconButton } from '../design-system';

interface GlobalSearchProps {
  currentUser: User;
  setActiveModule: (moduleData: { module: string; selectedId?: string } | string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'quote' | 'client' | 'inventory' | 'cashflow' | 'request';
  module: string;
  key: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ currentUser, setActiveModule }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [debouncedTerm, setDebouncedTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { quotes = [] } = useQuotes(currentUser) || {};
  const { items: inventory = [] } = useInventory(currentUser) || {};
  const { savedClients: clients = [] } = useClients(currentUser) || {};
  const { entries: cashflowEntries = [], allEntries: cashflowAll = [] } = useCashflow(currentUser, 'all') || {};
  const { requests = [] } = useMaterialRequests(currentUser) || {};

  useEffect(() => {
    if (!currentUser) return;
    
    if (debouncedTerm.length < 2) {
      setResults([]);
      return;
    }

    try {
      // 1. VALIDACIÓN OBLIGATORIA DE ARRAYS (FASE 3)
      const safeQuotes = Array.isArray(quotes) ? quotes : [];
      const safeInventory = Array.isArray(inventory) ? inventory : [];
      const safeClients = Array.isArray(clients) ? clients : [];
      const safeCashflowAll = Array.isArray(cashflowAll) ? cashflowAll : [];
      const safeCashflowEntries = Array.isArray(cashflowEntries) ? cashflowEntries : [];
      const safeRequests = Array.isArray(requests) ? requests : [];

      const term = debouncedTerm.toLowerCase();
      const newResults: SearchResult[] = [];

      const cashflowToSearch = safeCashflowAll.length > 0 ? safeCashflowAll : safeCashflowEntries;

      const safeLower = (value: any) => {
        return (value || "").toString().toLowerCase();
      };

      // Search Quotes
      safeQuotes.forEach(q => {
        try {
          if (!q) {
            console.warn("Elemento inválido en búsqueda (quote):", q);
            return;
          }
          const empresa = safeLower(q?.empresa || "");
          const idStr = safeLower(q?.id || "");
          const contacto = safeLower(q?.contacto || "");

          if (empresa.includes(term) || idStr.includes(term) || contacto.includes(term)) {
            newResults.push({
              id: q?.docId || q?.id?.toString() || "",
              title: `Cotización #${q?.id || "S/N"}`,
              subtitle: q?.empresa || "Sin Empresa",
              type: 'quote',
              module: 'cotizaciones',
              key: 'docId'
            });
          }
        } catch (err) {
          console.error("❌ [GlobalSearch] Error filtering quote:", q, err);
        }
      });

      // Search Clients
      safeClients.forEach(c => {
        try {
          if (!c) {
            console.warn("Elemento inválido en búsqueda (client):", c);
            return;
          }
          const empresa = safeLower(c?.empresa || "");
          const contacto = safeLower(c?.contacto || "");

          if (empresa.includes(term) || contacto.includes(term)) {
            newResults.push({
              id: c?.id || "",
              title: c?.empresa || "Sin Empresa",
              subtitle: `Cliente: ${c?.contacto || "Sin Contacto"}`,
              type: 'client',
              module: 'clientes',
              key: 'id'
            });
          }
        } catch (err) {
          console.error("❌ [GlobalSearch] Error filtering client:", c, err);
        }
      });

      // Search Inventory
      safeInventory.forEach(i => {
        try {
          if (!i) {
            console.warn("Elemento inválido en búsqueda (inventory):", i);
            return;
          }
          const desc = safeLower(i?.description || "");
          const code = safeLower(i?.code || "");

          if (desc.includes(term) || code.includes(term)) {
            const available = (i?.stock || 0) - (i?.reserved || 0);
            newResults.push({
              id: i?.id || "",
              title: i?.description || "Sin descripción",
              subtitle: `Inv: ${i?.code || "S/C"} - Disponible: ${available}`,
              type: 'inventory',
              module: 'inventario',
              key: 'code'
            });
          }
        } catch (err) {
          console.error("❌ [GlobalSearch] Error filtering inventory item:", i, err);
        }
      });

      // Search Cashflow
      cashflowToSearch.forEach(e => {
        try {
          if (!e) {
            console.warn("Elemento inválido en búsqueda (cashflow):", e);
            return;
          }
          const desc = safeLower(e?.description || "");
          const invoice = safeLower(e?.invoice || "");

          if (desc.includes(term) || invoice.includes(term)) {
            newResults.push({
              id: e?.id || "",
              title: e?.description || "Sin Movimiento",
              subtitle: `Mov: ${e?.type || "N/A"} - ${e?.amount || 0} ${e?.currency || ""}`,
              type: 'cashflow',
              module: 'movimientos',
              key: 'id'
            });
          }
        } catch (err) {
          console.error("❌ [GlobalSearch] Error filtering cashflow entry:", e, err);
        }
      });

      // Search Material Requests
      safeRequests.forEach(r => {
        try {
          if (!r) {
            console.warn("Elemento inválido en búsqueda (request):", r);
            return;
          }
          const project = safeLower(r?.projectName || "");
          const requester = safeLower(r?.requestedByName || "");

          if (project.includes(term) || requester.includes(term)) {
            newResults.push({
              id: r?.id || "",
              title: `Solicitud: ${r?.projectName || "S/P"}`,
              subtitle: `Por: ${r?.requestedByName || "Anónimo"} - Estado: ${r?.status || "Pendiente"}`,
              type: 'request',
              module: 'material_report',
              key: 'id'
            });
          }
        } catch (err) {
          console.error("❌ [GlobalSearch] Error filtering material request:", r, err);
        }
      });

      setResults(newResults.slice(0, 10));
      setIsOpen(true);
    } catch (globalErr) {
      console.error("❌ [GlobalSearch] CRITICAL ERROR during search filtering:", globalErr);
    }
  }, [debouncedTerm, quotes, inventory, clients, cashflowEntries, cashflowAll, requests, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setActiveModule({
      module: result.module,
      selectedId: result.id,
      selectedKey: result.key
    });
    setSearchTerm('');
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'quote': return <FiFileText className="text-blue-500" />;
      case 'client': return <FiUsers className="text-green-500" />;
      case 'inventory': return <FiBox className="text-orange-500" />;
      case 'cashflow': return <FiDollarSign className="text-emerald-500" />;
      case 'request': return <FiClipboard className="text-purple-500" />;
      default: return <FiSearch />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'quote': return 'Cotización';
      case 'client': return 'Cliente';
      case 'inventory': return 'Inventario';
      case 'cashflow': return 'Movimiento';
      case 'request': return 'Solicitud';
      default: return type;
    }
  };

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
        <input
          type="text"
          placeholder="Búsqueda global..."
          className="w-full bg-blue-800/50 border border-blue-700 text-white rounded-full py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-blue-400 text-sm"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
        />
          {searchTerm && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <IconButton 
                icon={<FiX />} 
                variant="ghost" 
                onClick={() => setSearchTerm('')} 
                title="Limpiar"
              />
            </div>
          )}
        </div>

        {isOpen && Array.isArray(results) && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {(results || []).map((result, index) => {
                try {
                  return (
                    <button
                      key={`${result?.type || 'unknown'}-${result?.id || index}`}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-none">
                        {getIcon(result?.type || '')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{result?.title || 'Sin Título'}</div>
                        <div className="text-xs text-slate-500 truncate">{result?.subtitle || ''}</div>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 flex-none">
                        {getTypeName(result?.type || '')}
                      </div>
                    </button>
                  );
                } catch (error) {
                  console.error("❌ [DIAGNOSTIC] ERROR ITEM:", result, error);
                  return null;
                }
              })}
            </div>
          </div>
        )}
    </div>
  );
};

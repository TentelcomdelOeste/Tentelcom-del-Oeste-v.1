import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FiSearch, FiFileText, FiUsers, FiBox, FiDollarSign, 
  FiX, FiClipboard, FiCalendar, FiTruck, FiLoader, 
  FiClock, FiTrash2, FiCornerDownLeft, FiUserCheck, FiTag, FiSend
} from 'react-icons/fi';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useQuotes } from '../hooks/useQuotes';
import { useInventory } from '../hooks/useInventory';
import { useClients } from '../hooks/useClients';
import { useCashflow } from '../hooks/useCashflow';
import { useMaterialRequests } from '../hooks/useMaterialRequests';
import { useEmployees } from '../hooks/useEmployees';
import { useCatalog } from '../hooks/useCatalog';
import { useDispatch } from '../hooks/useDispatch';
import { User } from '../utils/types';
import { 
  globalSearchEngine, 
  quoteSearchPlugin, 
  clientSearchPlugin, 
  inventorySearchPlugin, 
  cashflowSearchPlugin, 
  materialRequestSearchPlugin,
  jobSearchPlugin,
  vehicleLogSearchPlugin,
  employeeSearchPlugin,
  catalogSearchPlugin,
  dispatchSearchPlugin,
  normalizeSearchString
} from '../core/search';

import { IconButton } from '../design-system';

interface GlobalSearchProps {
  currentUser: User;
  setActiveModule: (moduleData: { module: string; selectedId?: string; selectedKey?: string } | string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'quote' | 'client' | 'inventory' | 'cashflow' | 'request' | 'job' | 'vehicle' | 'employee' | 'catalog' | 'dispatch';
  module: string;
  key: string;
  originalRes?: any;
}

interface RecentSearchItem {
  id: string;
  title: string;
  subtitle: string;
  type: SearchResult['type'];
  module: string;
  key: string;
  originalRes?: any;
  timestamp: number;
}

const RECENT_SEARCHES_KEY = 'global_search_recents_v1';

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ currentUser, setActiveModule }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [debouncedTerm, setDebouncedTerm] = useState('');

  // 1. Cargar búsquedas recientes de localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Error cargando búsquedas recientes:", e);
    }
  }, []);

  // 2. Guardar búsqueda reciente
  const saveRecentSearch = (result: SearchResult) => {
    try {
      const newItem: RecentSearchItem = {
        id: result.id,
        title: result.title,
        subtitle: result.subtitle,
        type: result.type,
        module: result.module,
        key: result.key,
        originalRes: result.originalRes,
        timestamp: Date.now()
      };

      const filtered = recentSearches.filter(
        item => !(item.type === newItem.type && item.id === newItem.id)
      );
      const updated = [newItem, ...filtered].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Error guardando reciente:", e);
    }
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // 3. Debounce de término de búsqueda (Optimizado para respuesta fluida)
  useEffect(() => {
    if (searchTerm.trim() !== debouncedTerm.trim()) {
      setIsSearching(true);
    }
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { quotes = [] } = useQuotes(currentUser) || {};
  const { items: inventory = [] } = useInventory(currentUser) || {};
  const { savedClients: clients = [] } = useClients(currentUser) || {};
  const { entries: cashflowEntries = [], allEntries: cashflowAll = [] } = useCashflow(currentUser, 'all') || {};
  const { requests = [] } = useMaterialRequests(currentUser) || {};
  const { employees = [] } = useEmployees() || {};
  const { catalog = [] } = useCatalog(currentUser) || {};
  
  const { requests: dispatchRequests = [] } = useDispatch(currentUser) || {};

  // Estados locales para colecciones que no tienen hooks dedicados
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [vehicleLogs, setVehicleLogs] = useState<any[]>([]);

  // Escuchar Trabajos Programados
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(collection(db, "trabajos"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrabajos(list);
    }, (err) => console.warn("Error cargando trabajos para búsqueda:", err));
    return () => unsub();
  }, [currentUser?.uid]);

  // Escuchar Bitácora de Vehículos
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(collection(db, "bitacora_vehiculos"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicleLogs(list);
    }, (err) => console.warn("Error cargando bitácora para búsqueda:", err));
    return () => unsub();
  }, [currentUser?.uid]);

  // 4. Sincronización completa con el motor de búsqueda global
  useEffect(() => {
    if (!currentUser) return;
    try {
      if (Array.isArray(quotes)) {
        quotes.forEach(q => {
          if (q) globalSearchEngine.upsertDocument(quoteSearchPlugin.mapToSearchableItem(q));
        });
      }
      if (Array.isArray(clients)) {
        clients.forEach(c => {
          if (c) globalSearchEngine.upsertDocument(clientSearchPlugin.mapToSearchableItem(c));
        });
      }
      if (Array.isArray(inventory)) {
        inventory.forEach(i => {
          if (i) globalSearchEngine.upsertDocument(inventorySearchPlugin.mapToSearchableItem(i));
        });
      }
      if (Array.isArray(requests)) {
        requests.forEach(r => {
          if (r) globalSearchEngine.upsertDocument(materialRequestSearchPlugin.mapToSearchableItem(r));
        });
      }
      const cashflowToSearch = (Array.isArray(cashflowAll) && cashflowAll.length > 0) ? cashflowAll : cashflowEntries;
      if (Array.isArray(cashflowToSearch)) {
        cashflowToSearch.forEach(e => {
          if (e) globalSearchEngine.upsertDocument(cashflowSearchPlugin.mapToSearchableItem(e));
        });
      }
      if (Array.isArray(trabajos)) {
        trabajos.forEach(j => {
          if (j) globalSearchEngine.upsertDocument(jobSearchPlugin.mapToSearchableItem(j));
        });
      }
      if (Array.isArray(vehicleLogs)) {
        vehicleLogs.forEach(v => {
          if (v) globalSearchEngine.upsertDocument(vehicleLogSearchPlugin.mapToSearchableItem(v));
        });
      }
      if (Array.isArray(employees)) {
        employees.forEach(emp => {
          if (emp) globalSearchEngine.upsertDocument(employeeSearchPlugin.mapToSearchableItem(emp));
        });
      }
      if (Array.isArray(catalog)) {
        catalog.forEach(prod => {
          if (prod) globalSearchEngine.upsertDocument(catalogSearchPlugin.mapToSearchableItem(prod));
        });
      }
      if (Array.isArray(dispatchRequests)) {
        dispatchRequests.forEach(disp => {
          if (disp) globalSearchEngine.upsertDocument(dispatchSearchPlugin.mapToSearchableItem(disp));
        });
      }
    } catch (err) {
      console.warn("[GlobalSearch] Index sync error:", err);
    }
  }, [
    quotes, clients, inventory, requests, cashflowAll, cashflowEntries, 
    trabajos, vehicleLogs, employees, catalog, dispatchRequests, currentUser?.uid
  ]);

  // 5. Ejecutar la búsqueda optimizada
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    if (debouncedTerm.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    globalSearchEngine.search(debouncedTerm, currentUser)
      .then(engineResults => {
        if (!isMounted) return;

        const mappedResults: SearchResult[] = engineResults.map(res => {
          let type: SearchResult['type'] = 'quote';
          const moduleName = res.moduleId;
          let key = 'id';
          
          if (res.moduleId === 'cotizaciones') {
            if (res.id.startsWith('client_')) {
              type = 'client';
              key = 'clienteId';
            } else {
              type = 'quote';
              key = 'docId';
            }
          } else if (res.moduleId === 'inventory_general') {
            type = 'inventory';
            key = 'id';
          } else if (res.moduleId === 'cashflow') {
            type = 'cashflow';
            key = 'id';
          } else if (res.moduleId === 'material_reports') {
            type = 'request';
            key = 'id';
          } else if (res.moduleId === 'job_scheduling') {
            type = 'job';
            key = 'id';
          } else if (res.moduleId === 'vehicles_logs') {
            type = 'vehicle';
            key = 'id';
          } else if (res.moduleId === 'admin') {
            type = 'employee';
            key = 'id';
          } else if (res.moduleId === 'external_products') {
            type = 'catalog';
            key = 'id';
          } else if (res.moduleId === 'dispatch') {
            type = 'dispatch';
            key = 'id';
          }

          const cleanId = res.id.replace(/^(quote_|client_|inventory_|cashflow_|mat_request_|job_|vehicleLog_|emp_|prod_|dispatch_)/, '');

          return {
            id: cleanId,
            title: res.title,
            subtitle: res.subtitle || '',
            type: type,
            module: moduleName,
            key: key,
            originalRes: res
          };
        });

        setResults(mappedResults);
        setIsOpen(true);
        setIsSearching(false);
        setSelectedIndex(-1);
      })
      .catch(err => {
        console.error("❌ [GlobalSearch] Error en motor de búsqueda:", err);
        if (isMounted) setIsSearching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedTerm, currentUser?.uid]);

  // 6. Atajo de teclado global (Ctrl+K / Cmd+K / /)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsOpen(true);
      } else if (
        e.key === '/' && 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 7. Evento click fuera del dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 8. Navegación por selección
  const handleSelect = useCallback((result: SearchResult) => {
    saveRecentSearch(result);
    if (result.originalRes) {
      const plugin = globalSearchEngine['registry'].getPlugin(result.originalRes.moduleId);
      if (plugin) {
        const nav = plugin.getNavigationContext(result.originalRes);
        setActiveModule(nav);
      } else {
        setActiveModule({ module: result.module, selectedId: result.id, selectedKey: result.key });
      }
    } else {
      setActiveModule({ module: result.module, selectedId: result.id, selectedKey: result.key });
    }
    setIsOpen(false);
    setSearchTerm('');
    setSelectedIndex(-1);
  }, [setActiveModule, recentSearches]);

  // 9. Filtrado por categorías activas
  const filteredResults = results.filter(r => {
    if (activeCategory === 'all') return true;
    return r.type === activeCategory;
  });

  // Auto-scroll del elemento seleccionado en la lista
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // 10. Manejo de teclado en el Input (ArrowUp, ArrowDown, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    const currentList = filteredResults;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < currentList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : currentList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && currentList[selectedIndex]) {
        handleSelect(currentList[selectedIndex]);
      } else if (currentList.length > 0) {
        handleSelect(currentList[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'quote': return <FiFileText className="text-blue-500" />;
      case 'client': return <FiUsers className="text-emerald-500" />;
      case 'inventory': return <FiBox className="text-orange-500" />;
      case 'cashflow': return <FiDollarSign className="text-teal-500" />;
      case 'request': return <FiClipboard className="text-purple-500" />;
      case 'job': return <FiCalendar className="text-cyan-500" />;
      case 'vehicle': return <FiTruck className="text-amber-500" />;
      case 'employee': return <FiUserCheck className="text-indigo-500" />;
      case 'catalog': return <FiTag className="text-rose-500" />;
      case 'dispatch': return <FiSend className="text-lime-600" />;
      default: return <FiSearch className="text-slate-400" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'quote': return 'Cotización';
      case 'client': return 'Cliente';
      case 'inventory': return 'Inventario';
      case 'cashflow': return 'Movimiento';
      case 'request': return 'Solicitud';
      case 'job': return 'Trabajo';
      case 'vehicle': return 'Vehículo';
      case 'employee': return 'Personal';
      case 'catalog': return 'Catálogo';
      case 'dispatch': return 'Despacho';
      default: return type;
    }
  };

  // 11. Resaltado visual de coincidencia insensible a tildes/mayúsculas
  const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return text;
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) return text;

    try {
      const normQuery = normalizeSearchString(cleanQuery);
      const queryTokens = normQuery.split(' ').filter(t => t.length >= 1);

      if (queryTokens.length === 0) return text;

      const words = text.split(/(\s+)/);
      return words.map((word, i) => {
        const normWord = normalizeSearchString(word);
        const isMatch = normWord.length > 0 && queryTokens.some(t => normWord.includes(t));
        if (isMatch) {
          return (
            <mark key={i} className="bg-amber-200 text-slate-900 rounded-sm px-0.5 font-bold">
              {word}
            </mark>
          );
        }
        return word;
      });
    } catch (e) {
      return text;
    }
  };

  // Categorías dinámicas con conteos
  const categories = [
    { id: 'all', label: 'Todos', count: results.length },
    { id: 'quote', label: 'Cotizaciones', count: results.filter(r => r.type === 'quote').length },
    { id: 'client', label: 'Clientes', count: results.filter(r => r.type === 'client').length },
    { id: 'inventory', label: 'Inventario', count: results.filter(r => r.type === 'inventory').length },
    { id: 'job', label: 'Trabajos', count: results.filter(r => r.type === 'job').length },
    { id: 'vehicle', label: 'Vehículos', count: results.filter(r => r.type === 'vehicle').length },
    { id: 'cashflow', label: 'Finanzas', count: results.filter(r => r.type === 'cashflow').length },
    { id: 'request', label: 'Solicitudes', count: results.filter(r => r.type === 'request').length },
    { id: 'dispatch', label: 'Despachos', count: results.filter(r => r.type === 'dispatch').length },
    { id: 'employee', label: 'Personal', count: results.filter(r => r.type === 'employee').length },
    { id: 'catalog', label: 'Catálogo', count: results.filter(r => r.type === 'catalog').length },
  ].filter(c => c.id === 'all' || c.count > 0);

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      {/* Container del Input de Búsqueda */}
      <div className="relative flex items-center">
        {isSearching ? (
          <FiLoader className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300 animate-spin w-4 h-4" />
        ) : (
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300 w-4 h-4 pointer-events-none" />
        )}
        
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          placeholder="Búsqueda global en todo el sistema... (Ctrl + K)"
          className="w-full bg-blue-800/50 border border-blue-700/80 text-white rounded-full py-2 pl-10 pr-20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all placeholder:text-blue-300/70 text-sm shadow-inner"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchTerm ? (
            <IconButton 
              icon={<FiX className="w-3.5 h-3.5" />} 
              variant="ghost" 
              onClick={() => {
                setSearchTerm('');
                setDebouncedTerm('');
                setResults([]);
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }} 
              title="Limpiar búsqueda"
            />
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-medium text-blue-200 bg-blue-900/60 border border-blue-700/60 rounded-md select-none pointer-events-none">
              <span>⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Modal de Búsqueda */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Categorías Filter Pills */}
          {results.length > 0 && categories.length > 2 && (
            <div className="flex items-center gap-1.5 p-2 bg-slate-50 border-b border-slate-100 overflow-x-auto no-scrollbar text-xs">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedIndex(-1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 flex-none ${
                    activeCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCategory === cat.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Lista de Resultados */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {filteredResults.length > 0 ? (
              filteredResults.map((result, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    ref={el => itemRefs.current[index] = el}
                    key={`${result.type}-${result.id}-${index}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group ${
                      isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none transition-transform group-hover:scale-105 ${
                      isSelected ? 'bg-blue-100 shadow-sm' : 'bg-slate-100'
                    }`}>
                      {getIcon(result.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate leading-snug">
                        {highlightMatch(result.title || 'Sin Título', debouncedTerm)}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {highlightMatch(result.subtitle || '', debouncedTerm)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {getTypeName(result.type)}
                      </span>
                      <FiCornerDownLeft className={`w-3.5 h-3.5 text-blue-500 transition-opacity ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                      }`} />
                    </div>
                  </button>
                );
              })
            ) : debouncedTerm.trim().length >= 2 && !isSearching ? (
              <div className="p-8 text-center">
                <FiSearch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Sin coincidencias encontradas</p>
                <p className="text-xs text-slate-400 mt-1">
                  No se encontraron resultados para &quot;<span className="font-semibold text-slate-600">{debouncedTerm}</span>&quot; en ningún módulo.
                </p>
              </div>
            ) : recentSearches.length > 0 && debouncedTerm.trim().length < 2 ? (
              /* Búsquedas recientes */
              <div className="p-2">
                <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <FiClock className="w-3.5 h-3.5" /> Búsquedas Recientes
                  </span>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    <FiTrash2 className="w-3 h-3" /> Limpiar
                  </button>
                </div>
                {recentSearches.map((item, idx) => (
                  <button
                    key={`recent-${item.type}-${item.id}-${idx}`}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-none">
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-700 truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                      {getTypeName(item.type)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 leading-relaxed">
                Escribe al menos 2 caracteres para buscar en <strong>cotizaciones, clientes, inventario, trabajos, vehículos, finanzas, solicitudes, personal o catálogo</strong>.
              </div>
            )}
          </div>

          {/* Footer Informativo de Atajos */}
          <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">↑↓</kbd> navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">↵</kbd> seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">esc</kbd> cerrar
              </span>
            </div>
            {results.length > 0 && (
              <span className="font-medium text-slate-500">
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

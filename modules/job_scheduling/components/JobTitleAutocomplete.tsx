import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiX, FiCheck, FiEdit2, FiTrash2, FiClock, FiPlus } from 'react-icons/fi';
import { useConfirm, UI_TOKENS, IconButton } from '@/design-system';
import { 
  JobTitle, 
  getJobTitles, 
  createOrUpdateJobTitle, 
  updateJobTitle, 
  deactivateJobTitle, 
  deleteJobTitle, 
  checkIfJobTitleUsed 
} from '../jobTitleService';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const JobTitleAutocomplete: React.FC<Props> = ({ value, onChange }) => {
  const [titles, setTitles] = useState<JobTitle[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  const fetchJobTitles = async () => {
    try {
      const data = await getJobTitles();
      setTitles(data);
    } catch (err) {
      console.error("Error loading job titles:", err);
    }
  };

  useEffect(() => {
    fetchJobTitles();
  }, []);

  // Sync state with incoming value
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Click outside to close and reset
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(value || '');
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [value]);

  const handleDelete = async (e: React.MouseEvent, item: JobTitle) => {
    e.stopPropagation();
    if (!item.id) return;

    try {
      const isUsed = await checkIfJobTitleUsed(item.titulo);

      if (isUsed) {
        const isConfirmed = await confirm({
          title: 'Desactivar Título del Trabajo',
          message: `"${item.titulo}" está asociado a trabajos históricos creados en el sistema.\n\nPara conservar el historial del sistema, no se eliminará físicamente, pero se marcará como Inactivo y no volverá a sugerirse para nuevas programaciones.\n\n¿Desea desactivarlo?`,
          confirmLabel: 'Desactivar',
          cancelLabel: 'Cancelar',
          variant: 'danger'
        });

        if (isConfirmed) {
          await deactivateJobTitle(item.id);
          await fetchJobTitles();
          if (value === item.titulo) {
            onChange('');
          }
        }
      } else {
        const isConfirmed = await confirm({
          title: 'Eliminar Título del Trabajo',
          message: `"${item.titulo}" no ha sido utilizado en ningún trabajo registrado.\n\n¿Desea eliminarlo permanentemente de la base de datos?`,
          confirmLabel: 'Eliminar',
          cancelLabel: 'Cancelar',
          variant: 'danger'
        });

        if (isConfirmed) {
          await deleteJobTitle(item.id);
          await fetchJobTitles();
          if (value === item.titulo) {
            onChange('');
          }
        }
      }
    } catch (err) {
      console.error("Error deleting job title:", err);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, item: JobTitle) => {
    e.stopPropagation();
    if (!item.id) return;
    setEditingId(item.id);
    setEditValue(item.titulo);
  };

  const handleSaveEdit = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const cleanValue = editValue.trim();
    if (!cleanValue) return;

    // Check for duplicates (case-insensitive)
    const alreadyExists = titles.some(t => t.id !== id && t.titulo.toLowerCase() === cleanValue.toLowerCase());
    if (alreadyExists) {
      alert("Ya existe un título con ese nombre.");
      return;
    }

    try {
      await updateJobTitle(id, cleanValue);
      setEditingId(null);
      await fetchJobTitles();

      const oldTitle = titles.find(t => t.id === id);
      if (oldTitle && value === oldTitle.titulo) {
        onChange(cleanValue);
      }
    } catch (err) {
      console.error("Error updating job title:", err);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditValue('');
  };

  const handleCreateNew = async () => {
    const newTitle = searchTerm.trim();
    if (!newTitle) return;

    try {
      await createOrUpdateJobTitle(newTitle);
      await fetchJobTitles();
      onChange(newTitle);
      setIsOpen(false);
    } catch (err) {
      console.error("Error creating job title:", err);
    }
  };

  // Smart sorting & filtering
  const sortedAndFilteredOptions = useMemo(() => {
    let filtered = titles;
    if (searchTerm && searchTerm !== value) {
      const term = searchTerm.toLowerCase();
      filtered = titles.filter(t => t.tituloNormalizado.includes(term));
    }

    return [...filtered].sort((a, b) => {
      // 1. Prioritize recently used (ultimaUtilizacion desc)
      const timeA = a.ultimaUtilizacion ? (typeof a.ultimaUtilizacion.toMillis === 'function' ? a.ultimaUtilizacion.toMillis() : (a.ultimaUtilizacion.seconds || 0) * 1000) : 0;
      const timeB = b.ultimaUtilizacion ? (typeof b.ultimaUtilizacion.toMillis === 'function' ? b.ultimaUtilizacion.toMillis() : (b.ultimaUtilizacion.seconds || 0) * 1000) : 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }

      // 2. Prioritize most used (frecuenciaUso desc)
      const freqA = a.frecuenciaUso || 0;
      const freqB = b.frecuenciaUso || 0;
      if (freqB !== freqA) {
        return freqB - freqA;
      }

      // 3. Fallback to alphabetical order
      return a.titulo.localeCompare(b.titulo);
    });
  }, [titles, searchTerm, value]);

  // Show create action only if search term has text and no case-insensitive match exists
  const showCreateOption = useMemo(() => {
    const cleanSearch = searchTerm.trim();
    if (!cleanSearch) return false;
    return !titles.some(t => t.titulo.toLowerCase() === cleanSearch.toLowerCase());
  }, [titles, searchTerm]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          const val = e.target.value.toUpperCase();
          setSearchTerm(val);
          onChange(val); // Ensure the parent gets the real-time changes
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        className={`w-full ${UI_TOKENS.SPACING.inputPadding} ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-slate-800 placeholder:text-slate-400`}
        placeholder="Ej: HOSPITAL PUNTARENAS, INSTALACIÓN FIBRA..."
      />
      {isOpen && (
        <div className="absolute z-50 w-full bg-white border border-slate-200 mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {sortedAndFilteredOptions.length > 0 ? (
            sortedAndFilteredOptions.map(t => (
              <div key={t.id}>
                {editingId === t.id ? (
                  <div 
                    className="p-2 bg-slate-50 flex items-center justify-between gap-2 border-b border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 font-bold text-slate-800"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(e as any, t.id!);
                        if (e.key === 'Escape') handleCancelEdit(e as any);
                      }}
                    />
                    <div className="flex items-center gap-0.5">
                      <IconButton
                        icon={<FiCheck className="w-3.5 h-3.5 text-green-600" />}
                        onClick={(e) => handleSaveEdit(e, t.id!)}
                        variant="ghost"
                        className="!p-1 !h-7 !w-7 hover:bg-green-50"
                        title="Guardar"
                      />
                      <IconButton
                        icon={<FiX className="w-3.5 h-3.5 text-slate-500" />}
                        onClick={(e) => handleCancelEdit(e)}
                        variant="ghost"
                        className="!p-1 !h-7 !w-7 hover:bg-slate-100"
                        title="Cancelar"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-2 hover:bg-slate-50 cursor-pointer text-sm flex items-center justify-between group border-b border-slate-50"
                    onClick={() => {
                      onChange(t.titulo);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 uppercase">{t.titulo}</span>
                      {t.frecuenciaUso && t.frecuenciaUso > 0 ? (
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                          <FiClock className="text-[10px]" /> {t.frecuenciaUso} {t.frecuenciaUso === 1 ? 'uso' : 'usos'}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        icon={<FiEdit2 className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />}
                        onClick={(e) => handleStartEdit(e, t)}
                        variant="ghost"
                        className="!p-1 !h-7 !w-7 hover:bg-slate-100"
                        title="Editar"
                      />
                      <IconButton
                        icon={<FiTrash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />}
                        onClick={(e) => handleDelete(e, t)}
                        variant="ghost"
                        className="!p-1 !h-7 !w-7 hover:bg-slate-100"
                        title="Eliminar/Desactivar"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : !showCreateOption ? (
            <div className="p-3 text-sm text-slate-400 text-center uppercase font-bold tracking-wider">
              Sin sugerencias
            </div>
          ) : null}

          {showCreateOption && (
            <div
              className="p-3 hover:bg-blue-50 cursor-pointer text-xs text-blue-600 font-bold flex items-center gap-1.5 border-t border-slate-100 transition-colors uppercase tracking-wider"
              onClick={handleCreateNew}
            >
              <FiPlus className="text-blue-500 stroke-[3px]" />
              <span>Crear nuevo título de trabajo &quot;{searchTerm}&quot;</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

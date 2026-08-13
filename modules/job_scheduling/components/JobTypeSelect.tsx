import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiX, FiCheck, FiEdit2, FiTrash2, FiClock, FiPlus } from 'react-icons/fi';
import { useConfirm, UI_TOKENS, IconButton } from '@/design-system';
import { 
  JobType, 
  getJobTypes, 
  createJobType, 
  updateJobType, 
  deactivateJobType, 
  deleteJobType, 
  checkIfJobTypeUsed 
} from '../jobTypeService';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: React.ReactNode;
}

export const JobTypeSelect: React.FC<Props> = ({ value, onChange, placeholder = "Seleccione tipo...", label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  const fetchJobTypes = async () => {
    try {
      const data = await getJobTypes();
      setJobTypes(data);
    } catch (err) {
      console.error("Error loading job types:", err);
    }
  };

  useEffect(() => {
    fetchJobTypes();
  }, []);

  // Sync search term with value from parent
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Handle click outside to close dropdown and reset input to selected value
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

  const handleDelete = async (e: React.MouseEvent, type: JobType) => {
    e.stopPropagation();
    if (!type.id) return;

    try {
      const isUsed = await checkIfJobTypeUsed(type.name);

      if (isUsed) {
        const isConfirmed = await confirm({
          title: 'Desactivar Tipo de Trabajo',
          message: `"${type.name}" está asociado a trabajos existentes en el sistema.\n\nPara mantener la integridad histórica de los registros, no se eliminará físicamente, pero se marcará como Inactivo y dejará de aparecer en futuras selecciones.\n\n¿Desea desactivarlo?`,
          confirmLabel: 'Desactivar',
          cancelLabel: 'Cancelar',
          variant: 'danger'
        });

        if (isConfirmed) {
          await deactivateJobType(type.id);
          await fetchJobTypes();
          if (value === type.name) {
            onChange('');
          }
        }
      } else {
        const isConfirmed = await confirm({
          title: 'Eliminar Tipo de Trabajo',
          message: `"${type.name}" no ha sido utilizado en ningún trabajo registrado.\n\n¿Desea eliminarlo permanentemente del catálogo?`,
          confirmLabel: 'Eliminar',
          cancelLabel: 'Cancelar',
          variant: 'danger'
        });

        if (isConfirmed) {
          await deleteJobType(type.id);
          await fetchJobTypes();
          if (value === type.name) {
            onChange('');
          }
        }
      }
    } catch (err) {
      console.error("Error deleting job type:", err);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, type: JobType) => {
    e.stopPropagation();
    if (!type.id) return;
    setEditingId(type.id);
    setEditValue(type.name);
  };

  const handleSaveEdit = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const cleanValue = editValue.trim();
    if (!cleanValue) return;

    // Check for duplicates (case-insensitive)
    const alreadyExists = jobTypes.some(t => t.id !== id && t.name.toLowerCase() === cleanValue.toLowerCase());
    if (alreadyExists) {
      alert("Ya existe un tipo de trabajo con ese nombre.");
      return;
    }

    try {
      await updateJobType(id, cleanValue);
      setEditingId(null);
      await fetchJobTypes();

      const oldType = jobTypes.find(t => t.id === id);
      if (oldType && value === oldType.name) {
        onChange(cleanValue);
      }
    } catch (err) {
      console.error("Error updating job type:", err);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditValue('');
  };

  const handleCreateNew = async () => {
    const newName = searchTerm.trim();
    if (!newName) return;

    try {
      await createJobType(newName);
      await fetchJobTypes();
      onChange(newName);
      setIsOpen(false);
    } catch (err) {
      console.error("Error creating job type:", err);
    }
  };

  // Smart suggestions filtering and sorting
  const sortedAndFilteredOptions = useMemo(() => {
    let filtered = jobTypes;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = jobTypes.filter(type => type.name.toLowerCase().includes(term));
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
      return a.name.localeCompare(b.name);
    });
  }, [jobTypes, searchTerm, value]);

  // Show creation suggestion only if searchTerm is not empty and has no exact case-insensitive match
  const showCreateOption = useMemo(() => {
    const cleanSearch = searchTerm.trim();
    if (!cleanSearch) return false;
    return !jobTypes.some(type => type.name.toLowerCase() === cleanSearch.toLowerCase());
  }, [jobTypes, searchTerm]);

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block"}>{label}</label>}
      <div className="relative">
        <input 
          type="text"
          className={`w-full ${UI_TOKENS.SPACING.inputPadding} ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none text-sm bg-white font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-100`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setSearchTerm(val);
            onChange(val); // Ensure the parent gets the real-time changes
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
        />
        {isOpen && (
          <div className="absolute z-50 w-full bg-white border border-slate-200 mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {sortedAndFilteredOptions.length > 0 ? (
              sortedAndFilteredOptions.map(type => (
                <div key={type.id}>
                  {editingId === type.id ? (
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
                          if (e.key === 'Enter') handleSaveEdit(e as any, type.id!);
                          if (e.key === 'Escape') handleCancelEdit(e as any);
                        }}
                      />
                      <div className="flex items-center gap-0.5">
                        <IconButton
                          icon={<FiCheck className="w-3.5 h-3.5 text-green-600" />}
                          onClick={(e) => handleSaveEdit(e, type.id!)}
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
                        onChange(type.name);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 uppercase">{type.name}</span>
                        {type.frecuenciaUso && type.frecuenciaUso > 0 ? (
                          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                            <FiClock className="text-[10px]" /> {type.frecuenciaUso} {type.frecuenciaUso === 1 ? 'uso' : 'usos'}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton
                          icon={<FiEdit2 className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />}
                          onClick={(e) => handleStartEdit(e, type)}
                          variant="ghost"
                          className="!p-1 !h-7 !w-7 hover:bg-slate-100"
                          title="Editar"
                        />
                        <IconButton
                          icon={<FiTrash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />}
                          onClick={(e) => handleDelete(e, type)}
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
                Sin coincidencias
              </div>
            ) : null}

            {showCreateOption && (
              <div
                className="p-3 hover:bg-blue-50 cursor-pointer text-xs text-blue-600 font-bold flex items-center gap-1.5 border-t border-slate-100 transition-colors uppercase tracking-wider"
                onClick={handleCreateNew}
              >
                <FiPlus className="text-blue-500 stroke-[3px]" />
                <span>Crear nuevo tipo de trabajo &quot;{searchTerm}&quot;</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

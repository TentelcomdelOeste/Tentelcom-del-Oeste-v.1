import React, { useState, useEffect, useMemo } from 'react';
import { JobTitle, getJobTitles } from '../jobTitleService';
import { UI_TOKENS } from '@/design-system';
import { FiClock } from 'react-icons/fi';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const JobTitleAutocomplete: React.FC<Props> = ({ value, onChange }) => {
  const [titles, setTitles] = useState<JobTitle[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchTitles = async () => {
      const data = await getJobTitles();
      setTitles(data);
    };
    fetchTitles();
  }, []);

  const suggestions = useMemo(() => {
    if (!value) return titles.sort((a, b) => b.frecuenciaUso - a.frecuenciaUso).slice(0, 5);
    return titles
      .filter(t => t.tituloNormalizado.includes(value.toLowerCase()))
      .sort((a, b) => b.frecuenciaUso - a.frecuenciaUso);
  }, [titles, value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className={`w-full pl-3 pr-3 py-2 ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold`}
        placeholder="Ej: HOSPITAL PUNTARENAS, INSTALACIÓN FIBRA..."
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-10 w-full bg-white border border-slate-200 mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map(t => (
            <div
              key={t.id}
              className="p-2 hover:bg-slate-50 cursor-pointer text-sm flex items-center justify-between"
              onClick={() => {
                onChange(t.titulo);
                setIsOpen(false);
              }}
            >
              <span>{t.titulo}</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <FiClock /> {t.frecuenciaUso} usos
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* eslint-disable no-restricted-syntax */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Employee } from '../../../financeTypes';
import { FiX, FiCheck, FiUsers, FiColumns, FiFileText, FiSearch } from 'react-icons/fi';
import { ActionButton, IconButton, ACTION_ICONS } from '../../../design-system';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';

export interface ExportColumnOption {
  key: string;
  label: string;
  header: string;
  dataKey: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  isCurrency?: boolean;
}

export const EMPLOYEE_PDF_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'code', label: 'Código / ID', header: 'ID', dataKey: 'code', width: 0.8 },
  { key: 'name', label: 'Nombre', header: 'Nombre', dataKey: 'name', width: 2.0 },
  { key: 'pos', label: 'Puesto', header: 'Puesto', dataKey: 'pos', width: 1.5 },
  { key: 'hire', label: 'Fecha de ingreso', header: 'Ingreso', dataKey: 'hire', width: 1.2 },
  { key: 'currency', label: 'Moneda', header: 'Moneda', dataKey: 'currency', width: 0.8, align: 'center' },
  { key: 'salary', label: 'Salario bruto', header: 'Salario Bruto', dataKey: 'salary', width: 1.5, align: 'right', isCurrency: true },
  { key: 'status', label: 'Estado', header: 'Estado', dataKey: 'status', width: 1.0, align: 'center' }
];

interface EmployeeExportPdfModalProps {
  show: boolean;
  onClose: () => void;
  employees: Employee[];
  showArchived?: boolean;
  onGenerate: (selectedEmployees: Employee[], selectedColumns: string[]) => Promise<void> | void;
}

export const EmployeeExportPdfModal: React.FC<EmployeeExportPdfModalProps> = ({
  show,
  onClose,
  employees,
  showArchived = false,
  onGenerate
}) => {
  useLockBodyScroll(show);

  const [mode, setMode] = useState<'all' | 'manual'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    EMPLOYEE_PDF_EXPORT_COLUMNS.map(col => col.key)
  );
  const [searchEmployee, setSearchEmployee] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Inicializar o resetear estado al abrir el modal
  useEffect(() => {
    if (show) {
      setMode('all');
      setSelectedIds(new Set(employees.map(e => e.id)));
      setSelectedColumns(EMPLOYEE_PDF_EXPORT_COLUMNS.map(col => col.key));
      setSearchEmployee('');
      setIsGenerating(false);
    }
  }, [show, employees]);

  // Filtrado de empleados en selección manual por búsqueda local
  const manualFilteredEmployees = useMemo(() => {
    if (!searchEmployee.trim()) return employees;
    const term = searchEmployee.toLowerCase();
    return employees.filter(e =>
      e.name.toLowerCase().includes(term) ||
      (e.employeeCode && e.employeeCode.toLowerCase().includes(term)) ||
      (e.position && e.position.toLowerCase().includes(term))
    );
  }, [employees, searchEmployee]);

  // Lista final de empleados a exportar según el modo
  const finalEmployeesToExport = useMemo(() => {
    if (mode === 'all') {
      return employees;
    }
    return employees.filter(e => selectedIds.has(e.id));
  }, [mode, employees, selectedIds]);

  const isFormValid = finalEmployeesToExport.length > 0 && selectedColumns.length > 0;

  if (!show) return null;

  // Toggle de selección de colaborador individual
  const toggleEmployee = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Seleccionar todos los colaboradores disponibles
  const handleSelectAllEmployees = () => {
    setSelectedIds(new Set(employees.map(e => e.id)));
  };

  // Desmarcar todos los colaboradores
  const handleDeselectAllEmployees = () => {
    setSelectedIds(new Set());
  };

  // Toggle de columna individual
  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // Seleccionar todas las columnas
  const handleSelectAllColumns = () => {
    setSelectedColumns(EMPLOYEE_PDF_EXPORT_COLUMNS.map(col => col.key));
  };

  // Desmarcar todas las columnas
  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  const handleGenerateClick = async () => {
    if (!isFormValid || isGenerating) return;
    setIsGenerating(true);
    try {
      await onGenerate(finalEmployeesToExport, selectedColumns);
      onClose();
    } catch (error) {
      console.error('Error al generar PDF de colaboradores:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[250] p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full max-w-xl rounded-[28px] sm:rounded-[32px] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-red-50 text-red-600 rounded-xl">
                <FiFileText className="text-lg" />
              </span>
              <h3 className="text-lg sm:text-xl font-black text-blue-950 uppercase tracking-tight">
                Exportar reporte de colaboradores
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1 ml-10">
              Directorio de personal ({showArchived ? 'Archivados' : 'Activos'})
            </p>
          </div>
          <IconButton
            variant="neutral"
            icon={<FiX />}
            onClick={onClose}
            disabled={isGenerating}
            title="Cerrar"
          />
        </div>

        {/* Body Scrollable */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
          {/* SECCIÓN 1: COLABORADORES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiUsers className="text-blue-600 text-sm" />
                <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                  1. Colaboradores a incluir
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {finalEmployeesToExport.length} de {employees.length} seleccionados
              </span>
            </div>

            {/* Opciones de modo */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setMode('all')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'all'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>Todos los visibles</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  mode === 'all' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {employees.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'manual'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>Selección manual</span>
                {mode === 'manual' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black bg-blue-50 text-blue-700">
                    {selectedIds.size}
                  </span>
                )}
              </button>
            </div>

            {/* Contenido modo manual */}
            {mode === 'manual' && (
              <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 space-y-3 animate-in fade-in duration-150">
                {/* Barra de herramientas de selección manual */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                  <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                      type="text"
                      placeholder="Buscar colaborador..."
                      value={searchEmployee}
                      onChange={e => setSearchEmployee(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 font-medium text-slate-700"
                    />
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleSelectAllEmployees}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100/60 rounded-lg transition-colors"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllEmployees}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-200/60 rounded-lg transition-colors"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                {/* Lista de colaboradores */}
                <div className="max-h-48 sm:max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {manualFilteredEmployees.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                      No se encontraron colaboradores coincidentes.
                    </div>
                  ) : (
                    manualFilteredEmployees.map(emp => {
                      const isSelected = selectedIds.has(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleEmployee(emp.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                              : 'bg-white border-slate-200/70 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center transition-all flex-none ${
                                isSelected ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <FiCheck className="text-[10px] stroke-[3]" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {emp.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium truncate">
                                {emp.position}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 flex-none">
                            {emp.employeeCode || 'S/C'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedIds.size === 0 && (
                  <p className="text-[11px] font-bold text-red-500 text-center pt-1">
                    Debes seleccionar al menos un colaborador para generar el reporte.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* SECCIÓN 2: COLUMNAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiColumns className="text-blue-600 text-sm" />
                <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                  2. Columnas a incluir
                </h4>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  className="px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Todas
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllColumns}
                  className="px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Ninguna
                </button>
              </div>
            </div>

            {/* Grid de columnas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EMPLOYEE_PDF_EXPORT_COLUMNS.map(col => {
                const isSelected = selectedColumns.includes(col.key);
                return (
                  <div
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-200 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200/70 hover:border-slate-300 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all flex-none ${
                          isSelected ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <FiCheck className="text-[10px] stroke-[3]" />}
                      </div>
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/60 flex-none">
                      {col.header}
                    </span>
                  </div>
                );
              })}
            </div>

            {selectedColumns.length === 0 && (
              <p className="text-[11px] font-bold text-red-500 text-center pt-1">
                Debes seleccionar al menos una columna para exportar.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end items-center flex-none">
          <ActionButton
            type="button"
            variant="ghost"
            label="Cancelar"
            onClick={onClose}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          />
          <ActionButton
            type="button"
            variant="danger"
            label={isGenerating ? "Generando..." : "Generar PDF"}
            icon={<ACTION_ICONS.pdf className="text-base" />}
            onClick={handleGenerateClick}
            disabled={!isFormValid || isGenerating}
            isLoading={isGenerating}
            className="w-full sm:w-auto !min-w-[160px]"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

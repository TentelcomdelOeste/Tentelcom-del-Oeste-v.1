import React from 'react';

export interface MonthYearFilterProps {
  year: number;
  month: number;
  years: number[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  disabled?: boolean;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const SELECT_CLASS = "px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

export const MonthYearFilter: React.FC<MonthYearFilterProps> = ({
  year,
  month,
  years,
  onYearChange,
  onMonthChange,
  disabled = false
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        disabled={disabled}
        className={SELECT_CLASS}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <select
        value={month}
        onChange={(e) => onMonthChange(Number(e.target.value))}
        disabled={disabled}
        className={SELECT_CLASS}
      >
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};
import React from 'react';
import { formatCurrency } from '../../../utils/formatCurrency';

export const ProjectAnalysisSummary = React.memo(({ totals, filterCurrency }: { totals: any, filterCurrency: 'CRC' | 'USD' | 'AMBAS' }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 md:p-4">
            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Presupuesto Total</p>
            {filterCurrency === 'AMBAS' ? (
                <div className="flex flex-col mt-1">
                    <span className="text-sm font-black text-slate-700">{formatCurrency(totals.usd.budget, 'USD')}</span>
                    <span className="text-sm font-black text-slate-700">{formatCurrency(totals.crc.budget, 'CRC')}</span>
                </div>
            ) : (
                <p className="text-sm md:text-xl font-black text-slate-700 mt-1">{formatCurrency(filterCurrency === 'USD' ? totals.usd.budget : totals.crc.budget, filterCurrency)}</p>
            )}
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 md:p-4">
            <p className="text-[9px] md:text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Ingresos Reales</p>
            {filterCurrency === 'AMBAS' ? (
                <div className="flex flex-col mt-1">
                    <span className="text-sm font-black text-emerald-600">{formatCurrency(totals.usd.income, 'USD')}</span>
                    <span className="text-sm font-black text-emerald-600">{formatCurrency(totals.crc.income, 'CRC')}</span>
                </div>
            ) : (
                <p className="text-sm md:text-xl font-black text-emerald-600 mt-1">{formatCurrency(filterCurrency === 'USD' ? totals.usd.income : totals.crc.income, filterCurrency)}</p>
            )}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 md:p-4">
            <p className="text-[9px] md:text-[10px] font-bold text-red-800 uppercase tracking-widest">Costos Reales</p>
            {filterCurrency === 'AMBAS' ? (
                <div className="flex flex-col mt-1">
                    <span className="text-sm font-black text-red-600">{formatCurrency(totals.usd.costs, 'USD')}</span>
                    <span className="text-sm font-black text-red-600">{formatCurrency(totals.crc.costs, 'CRC')}</span>
                </div>
            ) : (
                <p className="text-sm md:text-xl font-black text-red-600 mt-1">{formatCurrency(filterCurrency === 'USD' ? totals.usd.costs : totals.crc.costs, filterCurrency)}</p>
            )}
        </div>
        <div className={`border rounded-2xl p-3 md:p-4 ${filterCurrency !== 'AMBAS' && (filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${filterCurrency !== 'AMBAS' && (filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance) >= 0 ? 'text-blue-800' : 'text-slate-800'}`}>Balance Neto</p>
            {filterCurrency === 'AMBAS' ? (
                <div className="flex flex-col mt-1">
                    <span className={`text-sm font-black ${totals.usd.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(totals.usd.balance, 'USD')}</span>
                    <span className={`text-sm font-black ${totals.crc.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(totals.crc.balance, 'CRC')}</span>
                </div>
            ) : (
                <p className={`text-sm md:text-xl font-black mt-1 ${(filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance) >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    {formatCurrency(filterCurrency === 'USD' ? totals.usd.balance : totals.crc.balance, filterCurrency)}
                </p>
            )}
        </div>
    </div>
));

ProjectAnalysisSummary.displayName = 'ProjectAnalysisSummary';

import React from 'react';
import { User } from '../../utils/types';
import { VehicleLogs } from './VehicleLogs';
import { VehicleAnalysis } from './VehicleAnalysis';
import { VehicleAnalysisDetail } from './VehicleAnalysisDetail';
import { VehicleCostAnalysis } from './VehicleCostAnalysis';
import ErrorBoundary from '../../core/ErrorBoundary';

interface VehiclesModuleProps {
    currentUser: User;
    activeView: 'registros' | 'analisis' | 'analisis_detalle' | 'analisis_costos';
    selectedId?: string;
    onSetActiveModule?: (module: string | any) => void;
}

// Module Logic

export const VehiclesModule: React.FC<VehiclesModuleProps> = ({ currentUser, activeView, selectedId, onSetActiveModule }) => {
    if (!currentUser) {
        return <div className="p-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Error: Sesión no válida</div>;
    }

    try {
        return (
            <ErrorBoundary>
                {activeView === 'registros' && <VehicleLogs currentUser={currentUser} selectedId={selectedId} onSetActiveModule={onSetActiveModule} />}
                {activeView === 'analisis' && <VehicleAnalysis currentUser={currentUser} onSetActiveModule={onSetActiveModule} />}
                {activeView === 'analisis_detalle' && selectedId && (
                    <VehicleAnalysisDetail currentUser={currentUser} unidadId={selectedId} onSetActiveModule={onSetActiveModule} />
                )}
                {activeView === 'analisis_costos' && selectedId && (
                    <VehicleCostAnalysis currentUser={currentUser} unidadId={selectedId} onSetActiveModule={onSetActiveModule} />
                )}
            </ErrorBoundary>
        );
    } catch (err) {
        console.error("🔥 [VehiclesModule] CRITICAL RENDER ERROR:", err);
        return <div className="p-10 text-red-600 font-bold">Error crítico en el módulo de vehículos.</div>;
    }
};

export default VehiclesModule;

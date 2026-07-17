import React, { useState } from 'react';
import { FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';
import { ModulePage } from '../../../components/ui/ModulePage';
import { Toolbar, ActionButton, DataTable, ConfirmModal, IconButton } from '../../../design-system';
import { AutomaticAdjustmentModal } from './AutomaticAdjustmentModal';
import { AutomaticAdjustmentDetailModal } from './AutomaticAdjustmentDetailModal';
import { Employee, PayStub } from '../../../financeTypes';
import { User } from '../../../utils/types';
import { isAdmin, hasPermission } from '../../../utils/permissions';
import { AutomaticAdjustment } from './automaticAdjustments.types';

interface AutomaticAdjustmentsSectionProps {
    currentUser: User | null;
    employees: Employee[];
    adjustments: AutomaticAdjustment[];
    payStubs: PayStub[];
    onSave: (data: any, id?: string) => Promise<{success: boolean; message?: string}>;
    onDelete: (id: string) => Promise<void>;
}

export const AutomaticAdjustmentsSection: React.FC<AutomaticAdjustmentsSectionProps> = ({
    currentUser,
    employees,
    adjustments,
    payStubs,
    onSave,
    onDelete
}) => {
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [editingAdjustment, setEditingAdjustment] = useState<AutomaticAdjustment | null>(null);
    const [viewingAdjustment, setViewingAdjustment] = useState<AutomaticAdjustment | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleEdit = (item: AutomaticAdjustment) => {
        setEditingAdjustment(item);
        setShowModal(true);
    };

    const handleView = (item: AutomaticAdjustment) => {
        setViewingAdjustment(item);
        setShowDetailModal(true);
    };

    const handleCloseModal = () => {
        setEditingAdjustment(null);
        setShowModal(false);
    };

    const handleCloseDetailModal = () => {
        setViewingAdjustment(null);
        setShowDetailModal(false);
    };

    const confirmDelete = async () => {
        if (deletingId) {
            await onDelete(deletingId);
            setDeletingId(null);
        }
    };

    const columns = [
        { header: "Colaborador", render: (item: AutomaticAdjustment) => <span className="font-medium text-slate-800">{item.employeeName}</span> },
        { 
            header: "Tipo", 
            render: (item: AutomaticAdjustment) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.type === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {item.type === 'ingreso' ? 'Ingreso (+)' : 'Deducción (-)'}
                </span>
            ) 
        },
        { header: "Concepto", render: (item: AutomaticAdjustment) => <span className="text-slate-600">{item.conceptName}</span> },
        { header: "Cuota", render: (item: AutomaticAdjustment) => <span className="font-medium">{`₡${item.fortnightlyQuota.toLocaleString()}`}</span> },
        { header: "Saldo", render: (item: AutomaticAdjustment) => <span className="text-slate-500 font-medium">{`₡${item.pendingBalance.toLocaleString()}`}</span> },
        { 
            header: "Estado", 
            render: (item: AutomaticAdjustment) => {
                let colorClass = 'bg-slate-100 text-slate-600';
                if (item.status === 'activo') colorClass = 'bg-blue-100 text-blue-700';
                if (item.status === 'pausado') colorClass = 'bg-amber-100 text-amber-700';
                return <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>{item.status}</span>;
            } 
        },
        { 
            header: "Acciones", 
            render: (item: AutomaticAdjustment) => (
                <div className="flex gap-2">
                    <IconButton icon={<FiEye />} onClick={() => handleView(item)} variant="primary" title="Visualizar" size="sm" />
                    {currentUser && (isAdmin(currentUser?.role) || hasPermission(currentUser, 'finanzas', 'comprobantes')) && (
                        <>
                            <IconButton icon={<FiEdit2 />} onClick={() => handleEdit(item)} variant="neutral" title="Editar" size="sm" />
                            <IconButton icon={<FiTrash2 />} onClick={() => setDeletingId(item.id)} variant="danger" title="Eliminar" size="sm" />
                        </>
                    )}
                </div>
            ) 
        },
    ];

    return (
        <>
            <ModulePage title="AJUSTES AUTOMÁTICOS" subtitle="Administración de ingresos y deducciones recurrentes aplicadas automáticamente a nómina.">
                <Toolbar 
                    right={
                        currentUser && (isAdmin(currentUser?.role) || hasPermission(currentUser, 'finanzas', 'comprobantes')) &&
                        <ActionButton onClick={() => { setEditingAdjustment(null); setShowModal(true); }} label="NUEVO AJUSTE" variant="success" />
                    }
                />
                <div className="mt-4">
                    <DataTable<AutomaticAdjustment>
                        data={adjustments}
                        columns={columns}
                        keyExtractor={(item) => item.id || Math.random().toString()}
                        isLoading={false}
                        emptyMessage="No existen ajustes registrados"
                    />
                </div>
            </ModulePage>

            <AutomaticAdjustmentModal 
                show={showModal} 
                onClose={handleCloseModal}
                employees={employees}
                onSave={onSave}
                editingAdjustment={editingAdjustment}
                currentUser={currentUser}
            />

            <AutomaticAdjustmentDetailModal
                show={showDetailModal}
                onClose={handleCloseDetailModal}
                adjustment={viewingAdjustment}
                payStubs={payStubs}
            />

            <ConfirmModal
                show={!!deletingId}
                title="¿Desea eliminar este ajuste automático?"
                description="Esta acción eliminará permanentemente el registro del ajuste automático. Esta acción no afectará colillas generadas anteriormente."
                confirmLabel="Eliminar"
                onConfirm={confirmDelete}
                onClose={() => setDeletingId(null)}
                variant="danger"
            />
        </>
    );
};


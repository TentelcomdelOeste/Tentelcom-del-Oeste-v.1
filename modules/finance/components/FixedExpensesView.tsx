import React, { useState, useMemo } from 'react';
import { useFixedExpenses } from '../../../hooks/useFixedExpenses';
import { User } from '../../../utils/types';
import { FixedExpense } from '../../../cashflowTypes';
import { formatCurrency } from '../../../utils/formatCurrency';
import { DataTable, Toolbar, SearchInput, ActionButton, IconButton, ACTION_ICONS, useConfirm } from '../../../design-system';
import { FixedExpenseModal } from './FixedExpenseModal';
import { FiStar } from "react-icons/fi";

interface FixedExpensesViewProps {
  currentUser: User;
  refreshCashflow: () => Promise<void>;
}

export const FixedExpensesView: React.FC<FixedExpensesViewProps> = ({ currentUser, refreshCashflow }) => {
  const { expenses, isLoading, addFixedExpense, updateFixedExpense, deleteFixedExpense, generatePendingExpenses, isGenerating, generateManualExpense } = useFixedExpenses(currentUser);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const confirm = useConfirm();

  const handleEdit = (expense: FixedExpense) => {
    setEditingExpense(expense);
    setShowModal(true);
  };

  const handleDelete = async (expense: FixedExpense) => {
    if (await confirm({
      title: 'Eliminar Gasto Fijo',
      description: `¿Estás seguro de eliminar el gasto fijo "${expense.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    })) {
      await deleteFixedExpense(expense.id);
    }
  };

  const handleGenerateManual = async (expense: FixedExpense) => {
    if (await confirm({
      title: 'Generar Movimiento',
      description: `¿Desea generar el movimiento financiero para el gasto fijo "${expense.name}"?`,
      confirmLabel: 'Generar Movimiento',
      variant: 'success'
    })) {
        await generateManualExpense(expense);
        await refreshCashflow();
    }
  };

  const handleGenerate = async () => {
    const now = new Date();
    await generatePendingExpenses(now.getFullYear(), now.getMonth() + 1);
  };

  const columns = [
    { header: "Nombre", accessorKey: "name", sortable: true },
    { 
      header: "Monto", 
      accessorKey: "amount", 
      render: (item: FixedExpense) => (
        <span className={`font-mono font-bold ${item.currency === 'USD' ? 'text-emerald-600' : 'text-blue-600'}`}>
          {formatCurrency(item.amount, item.currency)}
        </span>
      )
    },
    { header: "Frecuencia", accessorKey: "frequency" },
    { header: "Día", accessorKey: "day", render: (item: FixedExpense) => `Día ${item.day}` },
    { header: "Subtipo", accessorKey: "subtype" },
    { 
      header: "Estado", 
      accessorKey: "status",
      render: (item: FixedExpense) => (
        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${item.status === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {item.status}
        </span>
      )
    },
    {
      header: "Acciones",
      accessorKey: "actions",
      render: (item: FixedExpense) => (
        <div className="flex gap-2 justify-end">
          {item.generationMode === 'Manual' && item.status === 'Activo' && (
            <IconButton 
              icon={<FiStar  />} 
              onClick={() => handleGenerateManual(item)} 
              variant="success"
              title="Generar Movimiento"
            />
          )}
          <IconButton 
            icon={<ACTION_ICONS.edit />} 
            onClick={() => handleEdit(item)} 
            variant="primary"
            title="Editar Gasto"
          />
          <IconButton 
            icon={<ACTION_ICONS.delete />} 
            onClick={() => handleDelete(item)} 
            variant="danger"
            title="Eliminar Gasto"
          />
        </div>
      )
    }
  ];

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [expenses, searchTerm]);

  const keyExtractor = (item: FixedExpense) => item.id;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Toolbar
        left={
          <SearchInput
            placeholder="Buscar gasto fijo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        }
        right={
          <div className="flex gap-2">
            <ActionButton
              label="Generar Mes Actual"
              icon={<FiStar  />}
              onClick={handleGenerate}
              isLoading={isGenerating}
              variant="secondary"
            />
            <ActionButton
              label="Nuevo Gasto"
              icon={<ACTION_ICONS.add />}
              onClick={() => { setEditingExpense(null); setShowModal(true); }}
              variant="primary"
            />
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable 
            data={filteredExpenses}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No hay gastos fijos configurados."
            keyExtractor={keyExtractor}
        />
      </div>

      <FixedExpenseModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        expenseToEdit={editingExpense}
        onSave={async (data) => {
            if (editingExpense) {
                await updateFixedExpense(editingExpense.id, data);
            } else {
                await addFixedExpense(data);
            }
            setShowModal(false);
        }}
      />
    </div>
  );
};

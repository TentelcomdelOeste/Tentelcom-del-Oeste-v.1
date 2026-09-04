
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from '../utils/types';
import { InventoryItem } from '../inventoryTypes';
import { useDispatch } from '../hooks/useDispatch';
import { MaterialRequest } from '../dispatchTypes';
import { normalizeOrigin } from '../utils/originUtils';
import { DataTable, TableColumn, IconButton, ACTION_ICONS, StatusBadge, ActionButton, SearchInput, Select } from '../design-system';
import { FiPackage, FiInfo, FiX, FiAlertCircle, FiAlertTriangle } from "react-icons/fi";
import { generateMaterialRequestPDF } from '../utils/pdfGenerator';

interface DispatchModuleProps {
  currentUser: User;
  inventoryItems: InventoryItem[]; // Necesario para validar stock visualmente
}

export const DispatchModule: React.FC<DispatchModuleProps> = ({ currentUser, inventoryItems }) => {
  const { requests, isLoading, processDispatch, deleteRequest, getResponsibleHistory } = useDispatch(currentUser);
  
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const handleDownloadPdf = async (req: MaterialRequest) => {
    if (!req) {
      setErrorMsg("No se encontró la solicitud.");
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    setDownloadingPdfId(req.id);
    setErrorMsg(null);
    try {
      await generateMaterialRequestPDF(req);
    } catch (err: any) {
      console.error("Error al generar PDF de la solicitud:", err);
      setErrorMsg("No fue posible generar el PDF de la solicitud. Intente nuevamente.");
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // Historial de responsables
  const [responsibleHistory, setResponsibleHistory] = useState<{label: string, value: string}[]>([]);

  // Cargar historial al abrir modal
  useEffect(() => {
    if (showModal) {
        getResponsibleHistory().then(history => {
            setResponsibleHistory(history);
        });
    } else {
        // Resetear ref cuando se cierra el modal para que al abrir de nuevo (incluso la misma) se limpie
        prevRequestIdRef.current = null;
    }
  }, [showModal, getResponsibleHistory]);

  // Estado para confirmación de eliminación
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ show: boolean, request: MaterialRequest | null }>({ show: false, request: null });

  // Formulario del Modal
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [responsibleName, setResponsibleName] = useState('');
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, string | number>>({});
  const prevRequestIdRef = useRef<string | null>(null);

  // Inicializar cantidades al abrir el modal
  useEffect(() => {
    if (selectedRequest) {
        // Solo resetear si es una solicitud diferente a la que ya teníamos cargada
        if (prevRequestIdRef.current !== selectedRequest.id) {
            const initialQty: Record<string, number> = {};
            selectedRequest.items.forEach(item => {
                // Por defecto: despachar lo que falta (quantityPending o quantityRequested si es vieja)
                const pending = item.quantityPending ?? item.quantityRequested;
                initialQty[item.inventoryItemId] = pending; 
            });
            setDispatchQuantities(initialQty);
            setDispatchDate(new Date().toISOString().split('T')[0]);
            setResponsibleName('');
            setErrorMsg(null);
            prevRequestIdRef.current = selectedRequest.id;
        }
    }
  }, [selectedRequest]);

  const handleOpenModal = (req: MaterialRequest) => {
      setSelectedRequest(req);
      setShowModal(true);
  };

  const handleCloseModal = () => {
      setShowModal(false);
      setSelectedRequest(null);
      setErrorMsg(null);
  };

  const handleQuantityChange = (itemId: string, val: string) => {
      const sanitizedVal = val.replace(',', '.');
      if (sanitizedVal === '' || /^\d*\.?\d*$/.test(sanitizedVal)) {
          setDispatchQuantities(prev => ({
              ...prev,
              [itemId]: sanitizedVal
          }));
      }
  };

  const validateDispatch = (): boolean => {
      if (!selectedRequest) return false;
      if (!responsibleName.trim()) {
          setErrorMsg("Debe indicar el nombre del responsable que entrega.");
          return false;
      }

      for (const item of selectedRequest.items) {
          const qtyToDispatch = Number(dispatchQuantities[item.inventoryItemId] || 0);
          const inventoryItem = inventoryItems.find(i => i.id === item.inventoryItemId);
          const stock = inventoryItem?.stock || 0;
          const reserved = inventoryItem?.reserved || 0;
          
          // El stock disponible para ESTA solicitud contemplando lo que ya tiene apartado
          // Pero ¡ojo!, lo que tiene apartado es lo que falta por despachar (quantityPending)
          const pending = item.quantityPending ?? item.quantityRequested;
          const availableForThisRequest = (stock - reserved) + pending;

          if (qtyToDispatch > pending) {
              setErrorMsg(`El ítem ${item.code} excede la cantidad pendiente (${pending}).`);
              return false;
          }
          if (qtyToDispatch > availableForThisRequest) {
              setErrorMsg(`Stock insuficiente para ${item.code}. Disponible: ${availableForThisRequest}`);
              return false;
          }
      }
      return true;
  };

  const handleConfirmDispatch = async () => {
      if (!validateDispatch() || !selectedRequest) return;

      setIsSubmitting(true);
      setErrorMsg(null);

      try {
          const itemsPayload = Object.entries(dispatchQuantities).map(([itemId, qty]) => ({
              itemId,
              dispatchQty: Number(qty)
          })).filter(i => i.dispatchQty > 0);

          if (itemsPayload.length === 0) {
              throw new Error("No hay ítems con cantidad mayor a 0 para despachar.");
          }

          await processDispatch(selectedRequest, {
              dispatchDate,
              responsibleName,
              items: itemsPayload
          });

          setSuccessMsg("Despacho registrado correctamente.");
          setTimeout(() => setSuccessMsg(null), 3000);
          handleCloseModal();

      } catch (err: any) {
          setErrorMsg(err.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleConfirmDelete = async () => {
      if (confirmDeleteModal.request) {
          try {
              await deleteRequest(confirmDeleteModal.request.id);
              setConfirmDeleteModal({ show: false, request: null });
              setSuccessMsg("Solicitud eliminada correctamente.");
              setTimeout(() => setSuccessMsg(null), 3000);
          } catch (error: any) {
              alert("Error al eliminar la solicitud: " + error.message);
          }
      }
  };

  // Filtrado y ordenado de solicitudes
  const filteredRequests = useMemo(() => {
    let result = requests.filter(req => req.status === 'Aprobada' || req.status === 'Parcial');
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(req => 
        (req.requestNumber || "").toLowerCase().includes(search) ||
        (req.projectName || "").toLowerCase().includes(search) ||
        (req.fdh || "").toLowerCase().includes(search) ||
        (req.torre || "").toLowerCase().includes(search)
      );
    }

    // Ordenar por fecha descendente (recientes primero)
    return result.sort((a, b) => {
      const dateA = a.createdAt || a.date || '';
      const dateB = b.createdAt || b.date || '';
      return dateB.localeCompare(dateA);
    });
  }, [requests, searchTerm]);

  // Definición de columnas para DataTable
  const columns = useMemo<TableColumn<MaterialRequest>[]>(() => [
    {
      header: 'ID Solicitud',
      render: (req) => (
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-blue-600 font-bold">{req.requestNumber || 'SOL-XXXX'}</span>
          <span className="text-[9px] text-slate-400 font-medium">{req.dispatchId || '---'}</span>
        </div>
      )
    },
    {
      header: 'Proyecto',
      render: (req) => (
        <div>
            <p className="font-bold text-blue-900 text-xs">{normalizeOrigin(req.origin)}</p>
            <p className="text-[10px] text-slate-400 font-bold">{req.projectCode || req.projectId}</p>
        </div>
      )
    },
    {
      header: 'Tipo / Origen',
      accessorKey: 'origin',
      className: 'font-bold text-xs text-slate-500'
    },
    {
      header: 'Estado',
      align: 'center',
      render: (req) => {
        let variant: 'success' | 'warning' | 'neutral' = 'neutral';
        if (req.status === 'Aprobada') variant = 'success';
        if (req.status === 'Parcial') variant = 'warning';
        return <StatusBadge label={req.status} variant={variant} />;
      }
    },
    {
      header: 'Fecha Solicitud',
      align: 'center',
      render: (req) => <span className="text-xs font-bold text-slate-500">{req.date}</span>
    },
    {
      header: 'Acción',
      align: 'center',
      render: (req) => {
        const isDownloading = downloadingPdfId === req.id;
        return (
          <div className="flex justify-center items-center gap-2">
              <ActionButton 
                  onClick={() => handleOpenModal(req)}
                  variant={req.status.toUpperCase() === 'DESPACHADA' ? 'ghost' : 'primary'}
                  label={req.status.toUpperCase() === 'DESPACHADA' ? 'Despachada' : 'Despachar'}
                  icon={<FiPackage />}
                  size="sm"
                  disabled={req.status.toUpperCase() === 'DESPACHADA'}
              />
              <IconButton 
                  icon={<ACTION_ICONS.pdf />} 
                  onClick={() => handleDownloadPdf(req)} 
                  variant="danger" 
                  title="Descargar PDF de solicitud"
                  disabled={isDownloading}
                  className={isDownloading ? "animate-pulse opacity-60" : ""}
              />
              <IconButton 
                  icon={<ACTION_ICONS.delete />} 
                  onClick={() => setConfirmDeleteModal({ show: true, request: req })} 
                  variant="danger" 
                  title="Eliminar Solicitud"
              />
          </div>
        );
      }
    }
  ], [downloadingPdfId]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Mensaje Informativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-none text-blue-600">
            <FiInfo  />
        </div>
        <div>
            <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight">Módulo de Despacho</h4>
            <p className="text-xs font-bold text-blue-700">
                El despacho de materiales solo estará disponible para solicitudes previamente aprobadas por la gerencia.
            </p>
        </div>
      </div>

      {!showModal && errorMsg && (
          <div className="bg-red-100 border border-red-200 text-red-800 p-4 rounded-xl text-center font-bold flex items-center justify-center gap-2">
              <FiAlertCircle className="w-5 h-5 flex-none" />
              <span>{errorMsg}</span>
          </div>
      )}

      {successMsg && (
          <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-xl text-center font-bold animate-pulse">
              {successMsg}
          </div>
      )}

      {/* Tabla de Solicitudes */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Solicitudes Pendientes de Despacho</h3>
                <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {filteredRequests.length} Pendientes
                </div>
            </div>
            <div className="w-full md:w-80">
                <SearchInput 
                    placeholder="Filtrar por SOL, Proyecto, FDH o Torre..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
        </div>
        
        <DataTable 
            data={filteredRequests}
            columns={columns}
            keyExtractor={(req: MaterialRequest) => req.id}
            isLoading={isLoading}
            emptyMessage="No hay solicitudes que coincidan con la búsqueda."
            enableVirtualization={true}
            virtualHeight={600}
        />
      </div>

      {/* MODAL DE DESPACHO */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl md:max-w-6xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                
                {/* Header Modal */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[32px]">
                    <div>
                        <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Confirmar Despacho</h3>
                        <p className="text-xs font-bold text-slate-500 mt-1">
                            {normalizeOrigin(selectedRequest.origin)}
                        </p>
                    </div>
                    <IconButton 
                        icon={<FiX />} 
                        onClick={handleCloseModal} 
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        variant="secondary"
                    />
                </div>

                {/* Body Modal */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Campos Generales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Fecha de Despacho</label>
                            <input 
                                type="date" 
                                value={dispatchDate}
                                onChange={e => setDispatchDate(e.target.value)}
                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <Select 
                                label="Responsable Entrega"
                                options={responsibleHistory}
                                value={responsibleName}
                                onChange={(val) => setResponsibleName(val)}
                                placeholder="Nombre de quien entrega"
                                isSearchable={true}
                                allowCustomValue={true}
                            />
                        </div>
                    </div>

                    {/* Tabla de Materiales */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                                    <th className="p-3">Material</th>
                                    <th className="p-3 text-center">Und</th>
                                    <th className="p-3 text-right">Solicitado</th>
                                    <th className="p-3 text-right">Pendiente</th>
                                    <th className="p-3 text-left">Comentario</th>
                                    <th className="p-3 text-right">Stock Disponible</th>
                                    <th className="p-3 text-right w-32">A Despachar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {selectedRequest.items.map(item => {
                                    const inventoryItem = inventoryItems.find(i => i.id === item.inventoryItemId);
                                    const stock = inventoryItem?.stock || 0;
                                    const reserved = inventoryItem?.reserved || 0;
                                    
                                    const pending = item.quantityPending ?? item.quantityRequested;
                                    const availableForThisRequest = (stock - reserved) + pending;
                                    
                                    const dispatchQty = dispatchQuantities[item.inventoryItemId] || 0;
                                    
                                    const isStockError = Number(dispatchQty) > availableForThisRequest;
                                    const isReqError = Number(dispatchQty) > pending;

                                    return (
                                        <tr key={item.inventoryItemId} className="bg-white">
                                            <td className="p-3">
                                                <p className="text-xs font-bold text-blue-900">{item.description}</p>
                                                <p className="text-[9px] font-mono text-slate-400">{item.code}</p>
                                            </td>
                                            <td className="p-3 text-center text-[10px] font-bold text-slate-500">{item.unit}</td>
                                            <td className="p-3 text-right text-xs font-black text-slate-400">{item.quantityRequested}</td>
                                            <td className="p-3 text-right text-xs font-black text-slate-800 bg-slate-50/50">{pending}</td>
                                            <td className="p-3 text-left text-[10px] font-bold text-slate-500 italic max-w-[150px] truncate" title={item.comment}>{item.comment || '-'}</td>
                                            <td className={`p-3 text-right text-xs font-black ${availableForThisRequest < pending ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                <div className="flex flex-col items-end">
                                                    <span>{availableForThisRequest}</span>
                                                    <span className="text-[8px] text-slate-400 font-normal uppercase">Libre: {Math.max(0, stock - reserved)}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    pattern="[0-9]*[.,]?[0-9]*"
                                                    value={dispatchQty === undefined || dispatchQty === null ? '' : dispatchQty}
                                                    onChange={(e) => handleQuantityChange(item.inventoryItemId, e.target.value)}
                                                    className={`w-full p-2 rounded-lg border text-right text-sm font-bold outline-none focus:ring-2 ${isStockError || isReqError ? 'border-red-300 ring-red-100 bg-red-50 text-red-600' : 'border-slate-200 focus:ring-blue-100 text-blue-900'}`}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Alerta de Errores */}
                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 text-center animate-pulse">
                            <FiAlertCircle className="mr-1"  /> {errorMsg}
                        </div>
                    )}

                </div>

                {/* Footer Modal */}
                <div className="p-6 bg-slate-50 rounded-b-[32px] flex gap-4">
                    <ActionButton 
                        onClick={handleCloseModal}
                        variant="secondary"
                        label="Cancelar"
                        className="flex-1"
                    />
                    <ActionButton 
                        onClick={handleConfirmDispatch}
                        disabled={isSubmitting}
                        isLoading={isSubmitting}
                        variant="primary"
                        label="CONFIRMAR"
                        className="flex-1"
                    />
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {confirmDeleteModal.show && (
          <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[250] p-4">
              <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in-95">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiAlertTriangle className="text-2xl"  />
                  </div>
                  <h3 className="text-xl font-black text-blue-950 mb-2">¿Eliminar Solicitud?</h3>
                  <p className="text-slate-500 text-sm font-bold mb-8">
                      ⚠️ Esta acción eliminará la solicitud de la lista de pendientes de despacho. ¿Deseas continuar?
                  </p>
                  <div className="flex gap-3">
                      <ActionButton 
                          onClick={() => setConfirmDeleteModal({ show: false, request: null })} 
                          variant="secondary"
                          label="Cancelar"
                          className="flex-1"
                      />
                      <ActionButton 
                          onClick={handleConfirmDelete} 
                          variant="danger"
                          label="Eliminar"
                          className="flex-1"
                      />
                  </div>
              </div>
          </div>
      )}

    </div>
    </div>
  );
};

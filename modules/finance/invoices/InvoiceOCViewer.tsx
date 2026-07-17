
import React, { useEffect, useState } from 'react';
import { POApplication, PurchaseOrder } from '../purchase_orders/types';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { FiLink } from "react-icons/fi";

interface InvoiceOCViewerProps {
  invoiceId: string;
}

export const InvoiceOCViewer: React.FC<InvoiceOCViewerProps> = ({ invoiceId }) => {
  const [applications, setApplications] = useState<POApplication[]>([]);
  const [relatedOCs, setRelatedOCs] = useState<Map<string, PurchaseOrder>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard clause: Validación inicial del prop
    if (!invoiceId || typeof invoiceId !== 'string') {
        setLoading(false);
        return;
    }

    const fetchLinkedData = async () => {
      setLoading(true);
      try {
        const appsRef = collection(db, 'purchase_order_applications');
        const q = query(appsRef, where('invoiceId', '==', invoiceId));
        const appSnap = await getDocs(q);
        
        const appsData: POApplication[] = [];
        const uniqueOcIds = new Set<string>();

        // Iteración segura validando la existencia y tipo de los datos
        appSnap.forEach((d) => {
            const data = d.data();
            // Validación estricta en runtime: solo procesamos si existe el ID de OC y es string
            if (data && typeof data.purchaseOrderId === 'string') {
                appsData.push({ id: d.id, ...data } as POApplication);
                uniqueOcIds.add(data.purchaseOrderId);
            }
        });

        setApplications(appsData);

        const ocMap = new Map<string, PurchaseOrder>();
        
        // Obtener OCs usando solo IDs validados
        for (const ocId of Array.from(uniqueOcIds)) {
            // Guard clause adicional antes de llamar a Firestore
            if (typeof ocId === 'string' && ocId.trim() !== '') {
                const ocRef = doc(db, 'purchase_orders', ocId);
                const snap = await getDoc(ocRef);
                
                if (snap.exists()) {
                    const ocData = snap.data();
                    if (ocData) {
                        ocMap.set(ocId, { id: snap.id, ...ocData } as PurchaseOrder);
                    }
                }
            }
        }
        setRelatedOCs(ocMap);

      } catch (error) {
        console.error("Error loading linked OCs", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLinkedData();
  }, [invoiceId]);

  if (loading) return <div className="text-xs text-slate-400">Cargando OCs vinculadas...</div>;
  if (applications.length === 0) return null;

  return (
    <div className="mt-6 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
      <h4 className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-3 flex items-center gap-2">
        <FiLink  /> Órdenes de Compra Asociadas
      </h4>
      <div className="space-y-2">
        {applications.map(app => {
          // Guard clause para el renderizado
          if (!app || !app.purchaseOrderId) return null;

          const oc = relatedOCs.get(app.purchaseOrderId);
          const dateStr = app.date ? new Date(app.date).toLocaleDateString() : 'N/A';
          const symbol = oc?.currency === 'USD' ? '$' : '¢';
          const amount = typeof app.appliedAmount === 'number' ? app.appliedAmount.toLocaleString() : '0.00';

          return (
            <div key={app.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-indigo-50 shadow-sm text-xs">
              <div className="flex flex-col">
                <span className="font-bold text-indigo-900">
                    {oc ? `OC: ${oc.ocNumber || 'S/N'}` : 'OC No Encontrada'}
                </span>
                <span className="text-[9px] text-slate-400">{dateStr}</span>
              </div>
              <span className="font-mono font-bold text-slate-700">
                Monto Aplicado: {oc ? symbol : ''}{amount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

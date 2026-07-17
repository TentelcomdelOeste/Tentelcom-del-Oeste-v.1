import React, { useState, useEffect, useMemo } from 'react';
import { RawProductData, ExternalProduct } from './types';
import { extractProductFromUrl } from './scraper.service';
import { normalizeProductData, NormalizedProductData } from './normalization.service';
import { useUserContext } from '../../contexts/UserContext';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ModuleHeader } from '../../components/ui/ModuleHeader';
import { useConfirm, DataTable, TableColumn, ActionButton, IconButton, StatusBadge, ACTION_ICONS } from '../../design-system';
import { FiList, FiDownloadCloud, FiMonitor, FiStar, FiZap, FiInfo, FiX, FiExternalLink } from "react-icons/fi";
import { triggerFileDownload } from '../../utils/fileUtils';

/**
 * Módulo completo para la gestión de Productos Externos dentro del Acceso Corporativo.
 * Combina el formulario de ingreso manual con el listado de revisión y aprobación.
 */
export const ExternalProductModule: React.FC = () => {
  const { currentUser, userPermisos } = useUserContext();
  const { authReady } = useAuth();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'review' | 'manual' | 'url' | 'processed'>('review');
  const [pendingProducts, setPendingProducts] = useState<ExternalProduct[]>([]);
  const [processedProducts, setProcessedProducts] = useState<ExternalProduct[]>([]);
  // Fix: renamed setLoading to setLoadingList to match usage in the rest of the component
  const [loadingList, setLoadingList] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ExternalProduct | null>(null);

  // Helper to check permissions
  const can = (module: string) => {
      return userPermisos?.[module] === true;
  };

  // Estados del Formulario Manual / URL
  const [formData, setFormData] = useState<RawProductData>({
    titulo_raw: '',
    descripcion_raw: '',
    especificaciones_raw: '',
    imagenes_raw: [],
    url_origen: '',
    fuente: 'Entrada Manual'
  });
  
  // Estado para Datos Normalizados (Sugeridos)
  const [normalizedData, setNormalizedData] = useState<NormalizedProductData>({
    titulo_normalizado: '',
    descripcion_normalizada: '',
    categoria_sugerida: '',
    marca_sugerida: ''
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  
  // New states as requested
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingPDFs, setExistingPDFs] = useState<string[]>([]);
  const [newPDFs, setNewPDFs] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<any>(null);

  // Estado para la IA
  const [isNormalizing, setIsNormalizing] = useState(false);

  // Estados para Extracción URL
  const [urlInput, setUrlInput] = useState('');
  const [providerSelect, setProviderSelect] = useState('INTCOMEX');
  const [isExtracting, setIsExtracting] = useState(false);

  const handleEdit = (prod: ExternalProduct) => {
      const images = prod.imagenes_raw || (prod as any).imagenes || [];
      setDebugPayload({
          id: prod.id,
          images: images,
          type: typeof images,
          isArray: Array.isArray(images)
      });
      setEditingProductId(prod.id);
      setFormData({
          titulo_raw: prod.titulo_raw || '',
          descripcion_raw: prod.descripcion_raw || '',
          especificaciones_raw: prod.especificaciones_raw || '',
          imagenes_raw: prod.imagenes_raw || (prod as any).imagenes || [],
          fichas_tecnicas: prod.fichas_tecnicas || [],
          url_origen: prod.url_origen || '',
          fuente: prod.proveedor || ''
      });
      setNormalizedData({
          titulo_normalizado: prod.titulo_normalizado || '',
          descripcion_normalizada: prod.descripcion_normalizada || '',
          categoria_sugerida: prod.categoria_sugerida || '',
          marca_sugerida: prod.marca_sugerida || ''
      });
      
      // Populate new states
      setExistingImages(prod.imagenes_base64 || prod.imagenes_raw || (prod as any).imagenes || []);
      setExistingPDFs(prod.fichas_tecnicas || []);
      setNewImages([]);
      setNewPDFs([]);
      setImagePreviews([]);
      
      setActiveTab('manual');
  };

  // 1. Cargar Productos Pendientes
  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (activeTab === 'review') {
        setLoadingList(true);
        // Se remueve orderBy para evitar el error de índice compuesto en Firestore
        // El ordenamiento se realiza en el cliente
        const q = query(
            collection(db, "external_products"), 
            where("estado", "==", "PENDIENTE")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ExternalProduct));
            
            // Ordenamiento en el cliente (descendente por fecha_ingreso)
            list.sort((a, b) => {
                const dateA = new Date(a.fecha_ingreso || 0).getTime();
                const dateB = new Date(b.fecha_ingreso || 0).getTime();
                return dateB - dateA;
            });

            setPendingProducts(list);
            setLoadingList(false);
        }, (error) => {
            console.error("Error cargando productos externos:", error);
            setLoadingList(false);
        });

        return () => unsubscribe();
    }
  }, [authReady, currentUser, activeTab]);

  // Load Processed Products
  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (activeTab === 'processed') {
        setLoadingList(true);
        const q = query(
            collection(db, "external_products"), 
            where("estado", "in", ["APROBADO", "RECHAZADO"])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ExternalProduct));
            
            // Ordenamiento en el cliente (descendente por updatedAt)
            list.sort((a, b) => {
                const A = (a as any).updatedAt?.seconds || 0;
                const B = (b as any).updatedAt?.seconds || 0;
                return B - A;
            });

            setProcessedProducts(list);
            setLoadingList(false);
        }, (error) => {
            console.error("Error cargando productos procesados:", error);
            setLoadingList(false);
        });

        return () => unsubscribe();
    }
  }, [authReady, currentUser, activeTab]);

  // 2. Manejadores de Acción (Aprobar/Rechazar/Eliminar)
  const handleUpdateStatus = async (id: string, newStatus: 'APROBADO' | 'RECHAZADO') => {
      try {
          const prodRef = doc(db, "external_products", id);
          const reviewerId = currentUser?.id || 'unknown';
          
          await updateDoc(prodRef, { 
              estado: newStatus,
              revisado_por: reviewerId,
              fecha_revision: new Date().toISOString(),
              updatedAt: serverTimestamp()
          });
          
          if (selectedProduct && selectedProduct.id === id) {
              setSelectedProduct(null); // Cerrar modal si estaba abierto
          }
      } catch (error) {
          console.error("Error al actualizar estado:", error);
          await confirm({
              title: "Error",
              description: "Error al actualizar el estado del producto.",
              confirmLabel: "Cerrar",
              variant: "warning"
          });
      }
  };

  const handleDelete = async (id: string) => {
      const confirmed = await confirm({
          title: "Confirmación",
          description: "¿Desea eliminar este producto?",
          confirmLabel: "Eliminar",
          variant: "danger"
      });
      if (!confirmed) return;
      try {
          await deleteDoc(doc(db, "external_products", id));
      } catch (error) {
          console.error("Error al eliminar:", error);
      }
  };

  // 3. Manejadores del Formulario
  const handleChange = (field: keyof RawProductData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNormalizedChange = (field: keyof NormalizedProductData, value: string) => {
    setNormalizedData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewImages(prev => [...prev, ...files]);
    
    const resizeAndToBase64 = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = reject;
        };
        reader.onerror = reject;
      });
    };

    const base64Images = await Promise.all(
        files.map(file => resizeAndToBase64(file))
    );
    
    setImagePreviews(prev => [...prev, ...base64Images]);
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setNewImages(prev => prev.filter((_, i) => i !== index));
      setImagePreviews(prev => {
        const newPreviews = [...prev];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        return newPreviews;
      });
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewPDFs(prev => [...prev, ...files]);
  };

  const removePdf = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingPDFs(prev => prev.filter((_, i) => i !== index));
    } else {
      setNewPDFs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleExtractFromUrl = async () => {
      if (!urlInput) {
          await confirm({
              title: "URL Inválida",
              description: "Ingrese una URL válida para continuar.",
              confirmLabel: "Entendido",
              variant: "warning"
          });
          return;
      }
      
      setIsExtracting(true);
      try {
          const extractedData = await extractProductFromUrl(urlInput, providerSelect);
          
          // Pre-llenar el formulario manual con los datos extraídos
          setFormData({
              ...extractedData,
              imagenes_raw: extractedData.imagenes_raw || []
          });
          
          // Pre-llenar normalizados por defecto con los raw (para no dejarlos vacíos)
          setNormalizedData({
              titulo_normalizado: extractedData.titulo_raw,
              descripcion_normalizada: extractedData.descripcion_raw,
              categoria_sugerida: '',
              marca_sugerida: ''
          });
          
          if (extractedData.imagenes_raw && extractedData.imagenes_raw.length > 0) {
              // Si la extracción devuelve URLs, las mantenemos en el estado de formData
              // pero no las mezclamos con los archivos locales
          }

          setActiveTab('manual');
          setFeedbackMsg('Datos extraídos correctamente. Puede refinar con IA o editar manualmente.');
          setStatus('success');
          setTimeout(() => setStatus('idle'), 3000);

      } catch (error: any) {
          await confirm({
              title: "Error de Extracción",
              description: error.message,
              confirmLabel: "Cerrar",
              variant: "warning"
          });
      } finally {
          setIsExtracting(false);
      }
  };

  const handleAiNormalization = async () => {
      if (!formData.titulo_raw && !formData.descripcion_raw) {
          await confirm({
              title: "Datos Insuficientes",
              description: "Ingrese al menos título o descripción en los datos crudos para usar la IA.",
              confirmLabel: "Entendido",
              variant: "warning"
          });
          return;
      }

      setIsNormalizing(true);
      try {
          const suggestions = await normalizeProductData(formData);
          setNormalizedData(suggestions);
          setFeedbackMsg('Sugerencias generadas por IA. Revise antes de guardar.');
          setStatus('success');
      } catch (error) {
          console.error(error);
          await confirm({
              title: "Error de IA",
              description: "Error al conectar con el servicio de IA.",
              confirmLabel: "Cerrar",
              variant: "warning"
          });
      } finally {
          setIsNormalizing(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setFeedbackMsg('');

    try {
        const docId = editingProductId || crypto.randomUUID();
        
        // Combinar imágenes existentes con las nuevas (que ya están en base64 en imagePreviews)
        const finalImagesBase64 = [...existingImages, ...imagePreviews];
        
        // Subir PDFs vía cola offline
        const { uploadPDFs } = await import('./externalProduct.service');
        await uploadPDFs(newPDFs, docId);
        
        // Mientras están encoladas para subida física, persistimos las ya existentes
        const finalPDFs = [...existingPDFs].map(url => url?.trim());
        
        const { serverTimestamp } = await import('firebase/firestore');
        
        const payload = {
          titulo_raw: formData.titulo_raw || "",
          descripcion_raw: formData.descripcion_raw || "",
          especificaciones_raw: formData.especificaciones_raw || "",
          proveedor: formData.fuente || "",
          imagenes_raw: [], // Deprecated
          imagenes_base64: finalImagesBase64,
          fichas_tecnicas: finalPDFs || [],
          estado: "PENDIENTE",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        setDebugPayload(payload);

        let result;
        if (editingProductId) {
            const { getDoc, doc } = await import('firebase/firestore');
            const docRef = doc(db, "external_products", editingProductId);
            const docSnap = await getDoc(docRef);
            const existingData = docSnap.data();

            const mergedPayload = {
                ...existingData,
                ...payload,
                imagenes_raw: [], // Deprecated
                imagenes_base64: finalImagesBase64,
                fichas_tecnicas: finalPDFs
            };

            const { updateExternalProduct } = await import('./externalProduct.service');
            result = await updateExternalProduct(editingProductId, mergedPayload);
        } else {
            // Crear nuevo producto con docId determinado previamente usando setDoc
            const { doc, setDoc } = await import('firebase/firestore');
            const docRef = doc(db, "external_products", docId);
            await setDoc(docRef, payload);
            result = { success: true, message: 'Producto creado correctamente.' };
        }

        if (result && result.success) {
            setStatus('success');
            setFeedbackMsg(result.message || 'Éxito');
            // Reset form
            setEditingProductId(null);
            setFormData({
                titulo_raw: '',
                descripcion_raw: '',
                especificaciones_raw: '',
                imagenes_raw: [],
                fichas_tecnicas: [],
                url_origen: '',
                fuente: ''
            });
            setNormalizedData({
                titulo_normalizado: '',
                descripcion_normalizada: '',
                categoria_sugerida: '',
                marca_sugerida: ''
            });
            setImageFiles([]);
            setImagePreviews([]);
            setPdfFiles([]);
            setUrlInput('');
            setTimeout(() => setActiveTab('review'), 1500); 
        } else {
            setStatus('error');
            setFeedbackMsg(result?.message || 'Error desconocido');
        }
    } catch (error: any) {
        console.error("Error en handleSubmit:", error);
        setStatus('error');
        setFeedbackMsg(error.message || 'Error al procesar la solicitud');
    } finally {
        // Asegurar que el estado de carga se quite si no fue éxito (éxito cambia de tab)
        if (status === 'loading') {
            setStatus('idle');
        }
    }
  };

  
// Definición de columnas para DataTable
const columns = useMemo<TableColumn<ExternalProduct>[]>(() => [
    {
        header: 'Imágenes',
        width: '220px',
        render: (row) => {

            let images = [];

            if (Array.isArray(row.imagenes_base64)) {
            images = row.imagenes_base64;
            } else if (Array.isArray(row.imagenes_raw)) {
            images = row.imagenes_raw;
            } else if (typeof row.imagenes_raw === 'string') {
            images = row.imagenes_raw.split('\n').map(x => x.trim()).filter(Boolean);
            }

            const cleanImages = images.filter(Boolean);

            return (
            <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                minHeight: '80px'
            }}>
                {cleanImages.map((img, i) => (
                    <div
                        key={i}
                        style={{
                            width: '60px',
                            height: '60px',
                            flexShrink: 0,
                            overflow: 'hidden',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: '#f8fafc'
                        }}
                    >
                        <img
                            src={img}
                            style={{
                                width: '60px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                ))}
            </div>
            );
        }
    },
    {
        header: 'Producto (Normalizado)',
        render: (prod) => (
            <div 
                className="cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors"
                onClick={() => setSelectedProduct(prod)}
                title="Clic para revisar detalles"
            >
                <div className="space-y-1">
                    <div>
                        <b className="text-xs text-slate-800 block">Título:</b>
                        <p className="font-bold text-blue-900 text-xs">{prod.titulo_normalizado || prod.titulo_raw}</p>
                    </div>
                    <div>
                        <b className="text-xs text-slate-800 block">Descripción:</b>
                        <p className="text-xs text-slate-600">{prod.descripcion_normalizada || prod.descripcion_raw}</p>
                    </div>
                    <div>
                        <b className="text-xs text-slate-800 block">Especificaciones:</b>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{prod.especificaciones_raw || 'Sin especificaciones'}</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        header: 'Fichas Técnicas',
        render: (row) => {
            return (
                <div className="flex flex-col gap-1">
                    {row.fichas_tecnicas?.map((pdf, i) => (
                        <button 
                            key={i}
                            onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                    const response = await fetch(pdf);
                                    const blob = await response.blob();
                                    await triggerFileDownload(blob, `Ficha_Tecnica_${row.nombre.replace(/[\s/]+/g, '_')}_${i + 1}.pdf`);
                                } catch(err) {
                                    console.error("Error downloading file:", err);
                                    if (typeof window !== 'undefined' && !(window as any).Capacitor?.isNativePlatform()) {
                                        const link = document.createElement('a');
                                        link.href = pdf;
                                        link.download = `Ficha_Tecnica_${row.nombre.replace(/[\s/]+/g, '_')}_${i + 1}.pdf`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    } else {
                                        alert(`No se pudo descargar el archivo: ${err}`);
                                    }
                                }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-left"
                        >
                            <FiInfo size={10} /> PDF {i + 1}
                        </button>
                    ))}
                </div>
            );
        }
    },
    {
        header: 'Categoría Inferida',
        render: (prod) => <StatusBadge label={prod.categoria_sugerida || 'Sin Categoría'} variant="neutral" />
    },
    {
        header: 'Fuente / Origen',
        render: (prod) => (
            <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-600">{prod.proveedor}</span>
                <span className="text-[9px] text-slate-400">{new Date(prod.fecha_ingreso).toLocaleDateString()}</span>
            </div>
        )
    },
    {
        header: 'Acciones',
        align: 'center',
        render: (prod) => (
            <div className="flex justify-center gap-2">
                {can('external_products') && (
                    <IconButton 
                        icon={<ACTION_ICONS.edit />} 
                        onClick={() => handleEdit(prod)}
                        variant="primary"
                        title="Editar"
                    />
                )}
                {can('external_products') && (
                    <IconButton 
                        icon={<ACTION_ICONS.approve />} 
                        onClick={async () => {
                            const confirmed = await confirm({
                                title: "Confirmación",
                                description: "¿Desea aprobar este producto?",
                                variant: "warning"
                            });
                            if (confirmed) await handleUpdateStatus(prod.id, 'APROBADO');
                        }}
                        variant="success"
                        title="Aprobar"
                    />
                )}
                {can('external_products') && (
                    <IconButton 
                        icon={<ACTION_ICONS.reject />} 
                        onClick={async () => {
                            const confirmed = await confirm({
                                title: "Confirmación",
                                description: "¿Desea rechazar este producto?",
                                variant: "warning"
                            });
                            if (confirmed) await handleUpdateStatus(prod.id, 'RECHAZADO');
                        }}
                        variant="danger"
                        title="Rechazar"
                    />
                )}
                {can('external_products') && (
                    <IconButton 
                        icon={<ACTION_ICONS.delete />} 
                        onClick={async () => {
                            const confirmed = await confirm({
                                title: "Confirmación",
                                description: "¿Desea eliminar este producto?",
                                variant: "warning"
                            });
                            if (confirmed) {
                                try {
                                    const { deleteDoc, doc } = await import('firebase/firestore');
                                    await deleteDoc(doc(db, "external_products", prod.id));
                                } catch (error) {
                                    console.error("Error al eliminar:", error);
                                }
                            }
                        }}
                        variant="danger"
                        title="Eliminar"
                    />
                )}
            </div>
        )
    }
  ], [confirm]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        <ModuleHeader 
            title="Revisión de Productos Externos" 
            subtitle="Gestión de datos crudos para incorporación al catálogo."
        />

        {/* Tabs */}
        <div className="flex flex-col gap-6 mb-8">
            <div className="flex border-b border-slate-200 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('review')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'review' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <FiList className="mr-2"  /> Pendientes ({pendingProducts.length})
                </button>
                <button
                    onClick={() => setActiveTab('url')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'url' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <FiDownloadCloud className="mr-2"  /> Desde URL
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'manual' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <FiMonitor className="mr-2"  /> Ingreso / Edición
                </button>
                <button
                    onClick={() => setActiveTab('processed')}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'processed' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <FiList className="mr-2"  /> Procesados ({processedProducts.length})
                </button>
            </div>
        </div>

        {/* CONTENIDO: Pestaña Revisión */}
        {activeTab === 'review' && (
            <div className="animate-in fade-in duration-300">
                <DataTable 
                    data={pendingProducts}
                    columns={columns}
                    keyExtractor={(prod: ExternalProduct) => prod.id}
                    isLoading={loadingList}
                    emptyMessage="No hay productos pendientes de revisión."
                    enableVirtualization={true}
                    virtualHeight={600}
                />
            </div>
        )}

        {/* CONTENIDO: Pestaña Procesados */}
        {activeTab === 'processed' && (
            <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedProducts.map(row => (
                    <div key={row.id} className="card p-4 bg-white border border-slate-200 rounded-xl shadow-sm" style={{
                        borderLeft: row.estado==="APROBADO"
                          ? "4px solid green"
                          : "4px solid red"
                      }}>
                        {/* IMÁGENES */}
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: '10px' }}>
                          {(row.imagenes_base64 || []).map((img,i)=>(
                            <img
                              key={i}
                              src={img}
                              style={{
                                width:60,
                                height:60,
                                objectFit:'cover',
                                borderRadius:6,
                                background:'#eee'
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ))}
                        </div>

                        {/* INFORMACIÓN */}
                        <div className="space-y-2">
                          <div>
                            <b className="text-sm text-slate-800 block">Título:</b>
                            <p className="text-xs text-slate-600">{row.titulo_raw}</p>
                          </div>
                          <div>
                            <b className="text-sm text-slate-800 block">Descripción:</b>
                            <p className="text-xs text-slate-600">{row.descripcion_raw}</p>
                          </div>
                          <div>
                            <b className="text-sm text-slate-800 block">Especificaciones:</b>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap">{row.especificaciones_raw || 'Sin especificaciones'}</p>
                          </div>
                          <div className="mt-2 text-xs text-slate-600">
                            <p><strong>Categoría:</strong> {row.categoria_sugerida || 'Sin Categoría'}</p>
                            <p><strong>Fuente:</strong> {row.proveedor || 'N/A'}</p>
                          </div>
                        </div>

                        {/* FICHAS TÉCNICAS */}
                        <div className="mt-2">
                          {row.fichas_tecnicas?.map((pdf, i) => (
                            <button 
                                key={i}
                                onClick={async () => {
                                    try {
                                        const response = await fetch(pdf);
                                        const blob = await response.blob();
                                        await triggerFileDownload(blob, `Ficha_Tecnica_${row.nombre.replace(/[\s/]+/g, '_')}_${i + 1}.pdf`);
                                    } catch(e) {
                                        console.error("Error downloading file:", e);
                                        if (typeof window !== 'undefined' && !(window as any).Capacitor?.isNativePlatform()) {
                                            const link = document.createElement('a');
                                            link.href = pdf;
                                            link.download = `Ficha_Tecnica_${row.nombre.replace(/[\s/]+/g, '_')}_${i + 1}.pdf`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        } else {
                                            alert(`No se pudo descargar el archivo: ${e}`);
                                        }
                                    }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-left"
                            >
                                <FiInfo size={10} /> PDF {i + 1}
                            </button>
                          ))}
                        </div>

                        {/* ESTADO */}
                        <div style={{ marginTop:6 }}>
                          {row.estado === "APROBADO" && (
                            <span style={{ color:'green', fontWeight:'bold', fontSize:'12px' }}>
                              ✔ APROBADO
                            </span>
                          )}

                          {row.estado === "RECHAZADO" && (
                            <span style={{ color:'red', fontWeight:'bold', fontSize:'12px' }}>
                              ✖ RECHAZADO
                            </span>
                          )}
                        </div>

                        {/* ACCIONES */}
                        <div style={{
                          display:'flex',
                          gap:12,
                          marginTop:10,
                          alignItems:'center'
                        }}>
                          {can('external_products') && (
                            <IconButton 
                                icon={<ACTION_ICONS.edit />} 
                                onClick={() => handleEdit(row)}
                                variant="primary"
                                title="Editar"
                            />
                          )}
                          {can('external_products') && (
                            <IconButton 
                                icon={<ACTION_ICONS.approve />} 
                                onClick={async () => {
                                    const confirmed = await confirm({
                                        title: "Retornar a Pendientes",
                                        description: "¿Desea mover este producto a la sección de pendientes?",
                                        confirmLabel: "Mover",
                                        variant: "warning"
                                    });
                                    if (confirmed) {
                                        await updateDoc(doc(db, "external_products", row.id), {
                                            estado: "PENDIENTE",
                                            updatedAt: serverTimestamp()
                                        });
                                    }
                                }}
                                variant="neutral"
                                title="Retornar a Pendientes"
                            />
                          )}
                          {can('external_products') && (
                            <IconButton 
                                icon={<ACTION_ICONS.delete />} 
                                onClick={() => handleDelete(row.id)}
                                variant="danger"
                                title="Eliminar"
                            />
                          )}
                        </div>
                    </div>
                ))}
                {processedProducts.length === 0 && (
                    <p className="col-span-full text-center text-slate-400 py-10">No hay productos procesados.</p>
                )}
            </div>
        )}

        {/* CONTENIDO: Pestaña URL */}
        {activeTab === 'url' && (
            <div className="max-w-2xl mx-auto animate-in fade-in duration-300 py-8 text-center">
                <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-600">
                    <FiStar className="text-3xl"  />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Importación Inteligente</h3>
                <p className="text-sm text-slate-500 font-bold mb-8">
                    Ingrese la URL del producto para extraer automáticamente la información técnica. 
                    <br/><span className="text-xs text-red-400">Nota: Precios y stock serán ignorados por seguridad.</span>
                </p>

                <div className="space-y-4 text-left bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">Proveedor Origen</label>
                        <select 
                            value={providerSelect}
                            onChange={(e) => setProviderSelect(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-100"
                        >
                            <option value="INTCOMEX">INTCOMEX</option>
                            <option value="OTRO">OTRO / GENÉRICO</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">URL del Producto</label>
                        <input 
                            type="url" 
                            placeholder="https://store.intcomex.com/..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-100"
                        />
                    </div>
                    <ActionButton 
                        onClick={handleExtractFromUrl}
                        disabled={isExtracting || !urlInput}
                        isLoading={isExtracting}
                        label="Extraer Información"
                        icon={<FiZap  />}
                        variant="primary"
                        fullWidth
                    />
                </div>
            </div>
        )}

        {/* CONTENIDO: Pestaña Ingreso Manual (También destino de URL) */}
        {activeTab === 'manual' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
                {feedbackMsg && (
                    <div className={`mb-6 p-4 rounded-xl text-xs font-bold border flex items-center gap-2 ${status === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                        <FiInfo  /> {feedbackMsg}
                    </div>
                )}

                <div className="flex gap-3 mb-6 flex-none justify-end">
                    <ActionButton 
                        onClick={() => {
                            setEditingProductId(null);
                            setFormData({
                                titulo_raw: '',
                                descripcion_raw: '',
                                especificaciones_raw: '',
                                imagenes_raw: [],
                                fichas_tecnicas: [],
                                url_origen: '',
                                fuente: ''
                            });
                            setNormalizedData({
                                titulo_normalizado: '',
                                descripcion_normalizada: '',
                                categoria_sugerida: '',
                                marca_sugerida: ''
                            });
                            setImageFiles([]);
                            setImagePreviews([]);
                            setPdfFiles([]);
                            setActiveTab('manual');
                        }}
                        label="Nuevo"
                        variant="primary"
                    />
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    
                    {/* SECCIÓN 1: Datos Crudos */}
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                            1. Datos Crudos (Origen)
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Título Crudo *</label>
                                <input 
                                    type="text" 
                                    value={formData.titulo_raw}
                                    onChange={e => handleChange('titulo_raw', e.target.value)}
                                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-100"
                                    placeholder="Ej: cable fibra optica monomodo 12 hilos exterior..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Descripción Cruda *</label>
                                <textarea 
                                    value={formData.descripcion_raw}
                                    onChange={e => handleChange('descripcion_raw', e.target.value)}
                                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-purple-100 h-24 resize-none"
                                    placeholder="Pegue aquí la descripción del proveedor."
                                    required
                                ></textarea>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Especificaciones</label>
                                    <textarea 
                                        value={formData.especificaciones_raw as string}
                                        onChange={e => handleChange('especificaciones_raw', e.target.value)}
                                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-600 outline-none focus:ring-2 focus:ring-purple-100 h-24 resize-none"
                                        placeholder="Detalles técnicos..."
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Imágenes</label>
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*" 
                                        onChange={handleFileChange}
                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                    />
                                    {/* Existing images */}
                                    {existingImages.length > 0 && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                            gap: '12px',
                                            marginTop: '1rem'
                                        }}>
                                            {existingImages.map((img, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        position: 'relative',
                                                        aspectRatio: '1 / 1',
                                                        borderRadius: '6px',
                                                        overflow: 'hidden',
                                                        border: '1px solid #ddd'
                                                    }}
                                                >
                                                    <img
                                                        src={img}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* New images */}
                                    {imagePreviews.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mt-4">
                                        {imagePreviews.map((preview, index) => (
                                          <div key={`new-${index}`} className="relative w-24 h-24 border rounded overflow-hidden group">
                                            <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            
                                            {/* Botón eliminar */}
                                            <button 
                                              type="button"
                                              onClick={() => removeImage(index, false)}
                                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                              <FiX size={12} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">URL Origen</label>
                                    <input 
                                        type="url" 
                                        value={formData.url_origen}
                                        onChange={e => handleChange('url_origen', e.target.value)}
                                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-medium text-blue-600 outline-none focus:ring-2 focus:ring-purple-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Proveedor</label>
                                    <input 
                                        type="text" 
                                        value={formData.fuente}
                                        onChange={e => handleChange('fuente', e.target.value)}
                                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-100"
                                        placeholder="Ej: Panduit, Cisco, Proveedor local"
                                    />
                                </div>
                            </div>
                            
                            {/* Fichas Técnicas (PDF) */}
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Fichas Técnicas (PDF)</label>
                                <input 
                                    type="file" 
                                    multiple 
                                    accept="application/pdf" 
                                    onChange={handlePdfChange}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {/* Existing PDFs */}
                                {existingPDFs.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {existingPDFs.map((pdf, index) => (
                                            <div key={`existing-pdf-${index}`} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                                                <button 
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const response = await fetch(pdf);
                                                            const blob = await response.blob();
                                                            await triggerFileDownload(blob, `PDF_Existente_${index + 1}.pdf`);
                                                        } catch(e) {
                                                            console.error("Error downloading file:", e);
                                                            if (typeof window !== 'undefined' && !(window as any).Capacitor?.isNativePlatform()) {
                                                                const link = document.createElement('a');
                                                                link.href = pdf;
                                                                link.download = `PDF_Existente_${index + 1}.pdf`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                            } else {
                                                                alert(`No se pudo descargar el archivo: ${e}`);
                                                            }
                                                        }
                                                    }}
                                                    className="truncate max-w-[200px] md:max-w-md text-blue-600 hover:underline text-left"
                                                >
                                                    PDF Existente {index + 1}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => removePdf(index, true)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <FiX />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* New PDFs */}
                                {newPDFs.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {newPDFs.map((file, index) => (
                                            <div key={`new-pdf-${index}`} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                                                <span className="truncate max-w-[200px] md:max-w-md">{file.name}</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => removePdf(index, false)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <FiX />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BOTÓN MÁGICO DE IA */}
                    <div className="flex justify-center">
                        <ActionButton 
                            onClick={handleAiNormalization}
                            disabled={isNormalizing}
                            isLoading={isNormalizing}
                            label="IA: Sugerir Normalización"
                            icon={<FiStar  />}
                            variant="secondary"
                        />
                    </div>

                    {/* SECCIÓN 2: Datos Normalizados */}
                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 space-y-6">
                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-2">
                            2. Datos Normalizados (Catálogo)
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Título Normalizado</label>
                                <input 
                                    type="text" 
                                    value={normalizedData.titulo_normalizado}
                                    onChange={e => handleNormalizedChange('titulo_normalizado', e.target.value)}
                                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Sugerido por IA o editar manualmente..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Descripción Normalizada</label>
                                <textarea 
                                    value={normalizedData.descripcion_normalizada}
                                    onChange={e => handleNormalizedChange('descripcion_normalizada', e.target.value)}
                                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-indigo-100 h-24 resize-none"
                                    placeholder="Resumen técnico limpio..."
                                ></textarea>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Categoría Sugerida</label>
                                    <input 
                                        type="text" 
                                        value={normalizedData.categoria_sugerida}
                                        onChange={e => handleNormalizedChange('categoria_sugerida', e.target.value)}
                                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                        placeholder="Ej: Fibra Óptica"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Marca Sugerida</label>
                                    <input 
                                        type="text" 
                                        value={normalizedData.marca_sugerida}
                                        onChange={e => handleNormalizedChange('marca_sugerida', e.target.value)}
                                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                        placeholder="Ej: Panduit"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col items-end gap-2">
                        <div className="flex gap-3 justify-center">
                            <ActionButton 
                                type="button"
                                onClick={() => {
                                    setEditingProductId(null);
                                    setFormData({
                                        titulo_raw: '',
                                        descripcion_raw: '',
                                        especificaciones_raw: '',
                                        imagenes_raw: [],
                                        fichas_tecnicas: [],
                                        url_origen: '',
                                        fuente: ''
                                    });
                                    setNormalizedData({
                                        titulo_normalizado: '',
                                        descripcion_normalizada: '',
                                        categoria_sugerida: '',
                                        marca_sugerida: ''
                                    });
                                    setImageFiles([]);
                                    setImagePreviews([]);
                                    setPdfFiles([]);
                                    setExistingImages([]);
                                    setExistingPDFs([]);
                                    setNewImages([]);
                                    setNewPDFs([]);
                                    setActiveTab('review');
                                }}
                                label="Cancelar"
                                variant="secondary"
                            />
                            <ActionButton 
                                type="submit"
                                disabled={status === 'loading'}
                                isLoading={status === 'loading'}
                                label="Guardar Pendiente"
                                icon={<ACTION_ICONS.save />}
                                variant="primary"
                            />
                        </div>
                    </div>
                </form>
            </div>
        )}

      </div>

      {/* Modal Detalle / Revisión */}
      {selectedProduct && (
          <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[500] p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Detalle del Producto</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {selectedProduct.id}</p>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm">
                          <FiX className="text-lg"  />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                      <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre Normalizado</label>
                          <p className="text-sm font-bold text-blue-900 bg-slate-50 p-3 rounded-xl border border-slate-100">{selectedProduct.titulo_normalizado || selectedProduct.titulo_raw}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Categoría Inferida</label>
                              <p className="text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">{selectedProduct.categoria_sugerida || 'N/A'}</p>
                          </div>
                          <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fuente</label>
                              <p className="text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">{selectedProduct.proveedor}</p>
                          </div>
                      </div>
                      <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Descripción</label>
                          <p className="text-xs font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">{selectedProduct.descripcion_normalizada || selectedProduct.descripcion_raw}</p>
                      </div>
                      
                      {/* JSON Raw Specs */}
                      <div className="bg-slate-900 rounded-xl p-4 overflow-hidden">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Datos Técnicos (JSON)</label>
                          <pre className="text-[10px] font-mono text-green-400 overflow-x-auto custom-scrollbar">
                              {JSON.stringify(selectedProduct.especificaciones_raw, null, 2)}
                          </pre>
                      </div>

                      {selectedProduct.url_origen && (
                          <a href={selectedProduct.url_origen} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-bold text-blue-600 hover:underline">
                              Ver fuente original <FiExternalLink className="ml-1"  />
                          </a>
                      )}
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <ActionButton 
                          onClick={() => handleUpdateStatus(selectedProduct.id, 'RECHAZADO')}
                          label="Rechazar"
                          variant="danger"
                          fullWidth
                      />
                      <ActionButton 
                          onClick={() => handleUpdateStatus(selectedProduct.id, 'APROBADO')}
                          label="Aprobar"
                          variant="success"
                          fullWidth
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
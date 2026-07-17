import { getYearFromDateString } from '../utils/dateUtils';
import { setVersionedDocOffline, updateVersionedDocOffline } from '../core/versionControl';
import { localDocStore } from '../core/offline/localDocStore';
import { Product } from '../types';
import { auditService } from '../services/auditService';

const inFlightSaves = new Set<string>();

/**
 * Calcula el siguiente número visual de cotización, reutilizando huecos si existen.
 */
export const calculateNextVisualQuoteNumber = async (year: number): Promise<number> => {
    const usedNumbers = new Set<number>();
    
    // 1. Prioridad: Datos Locales (SQLite) para garantizar funcionamiento OFFLINE
    try {
        const localDocs = await localDocStore.getLocalCollection("quotes");
        localDocs.forEach(item => {
            const data = item.data;
            const num = data.visualQuoteNumber || (typeof data.id === 'string' ? parseInt(data.id) : Number(data.id));
            const qYear = data.year || getYearFromDateString(data.fecha);
            
            if (num && !isNaN(num) && qYear === year) {
                usedNumbers.add(num);
            }
        });
    } catch (localError) {
        console.error("Error recuperando correlativos locales:", localError);
    }

    // 2. Opcional: Intentar sincronizar con Firestore si hay conexión (pero sin bloquear si falla)
    // Nota: En un entorno puramente offline, getDocs fallará o tardará mucho.
    // Para cumplir con el requerimiento de "Eliminar dependencia obligatoria", 
    // se asume que la sincronización de fondo mantendrá SQLite actualizado.
    
    let i = 1;
    while (usedNumbers.has(i)) {
        i++;
    }
    return i;
};

/**
 * Proceso centralizado y seguro para guardar una cotización.
 * Maneja validaciones, generación de IDs y persistencia atómica.
 */
export const guardarCotizacionSeguro = async (params: SaveQuoteParams) => {
  const { 
    quote, clientData, items, metaData, applyTax, total, 
    isNewClient, isClientModified, savedClients, catalogMap,
    addClient, updateClient, addProduct
  } = params;
  
  // 1. Validaciones básicas
  if (!clientData.empresa) throw new Error("EL NOMBRE DE LA EMPRESA ES OBLIGATORIO.");

  // A. ID Generation (Decoupled)
  const isNewQuote = !quote?.docId;
  
  // Usar fecha proporcionada o ahora, pero siempre convertir a objeto Date para cálculos estables
  let fecha: string;
  let dateObj: Date;
  
  if (quote?.fecha) {
      fecha = quote.fecha;
      // Intentar parsear DD/MM/YYYY
      if (fecha.includes('/')) {
          const [d, m, y] = fecha.split('/').map(Number);
          dateObj = new Date(y, m - 1, d);
      } else {
          dateObj = new Date(fecha);
      }
  } else {
      dateObj = new Date();
      fecha = dateObj.toLocaleDateString('es-GB'); // "DD/MM/YYYY" estable
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;

  // UUID para Firestore DocID
  const docId = (quote?.docId && quote.docId !== 'unknown' && !quote.docId.startsWith('temp_')) 
    ? quote.docId 
    : crypto.randomUUID();

  // Calcular correlativo visual o usar el proporcionado por params.newId
  let visualQuoteNumber = quote?.visualQuoteNumber;
  let finalQuoteId = params.newId; // Prioridad al ID que viene de la UI (ya viene con padding)

  if (!visualQuoteNumber) {
      if (finalQuoteId && !isNaN(parseInt(finalQuoteId))) {
          visualQuoteNumber = parseInt(finalQuoteId);
      } else {
          visualQuoteNumber = await calculateNextVisualQuoteNumber(year);
      }
  }
  
  if (!finalQuoteId) {
      finalQuoteId = visualQuoteNumber.toString().padStart(3, '0');
  }

  // Prevención de duplicados concurrentes en el servicio
  const saveKey = isNewQuote ? `new-${finalQuoteId}` : `update-${docId}`;
  if (inFlightSaves.has(saveKey)) {
      console.warn(`[QuoteService] Bloqueo de guardado concurrente para la llave: ${saveKey}`);
      return { docId, finalQuoteId, status: 'blocked' };
  }
  inFlightSaves.add(saveKey);
  
  try {
    // 2. A. Gestión de Cliente
  let finalCodigoCliente = clientData.codigoCliente;
  if (isNewClient || isClientModified || !finalCodigoCliente) {
    const exactClientMatch = savedClients.find(c => 
        c.isActive !== false && 
        c.empresa.trim().toLowerCase() === clientData.empresa.trim().toLowerCase() &&
        c.contacto.trim().toLowerCase() === clientData.contacto.trim().toLowerCase()
    );

    if (exactClientMatch) {
        finalCodigoCliente = exactClientMatch.codigoCliente;
        if (exactClientMatch.telefono !== clientData.telefono || exactClientMatch.correo !== clientData.correo) {
            await updateClient(exactClientMatch.id, {
                telefono: clientData.telefono.trim(),
                correo: clientData.correo.trim()
            });
        }
    } else {
        const newClient = await addClient({
            empresa: clientData.empresa.trim(),
            contacto: clientData.contacto.trim(),
            telefono: clientData.telefono.trim(),
            correo: clientData.correo.trim(),
            codigoCliente: '',
            isActive: true
        });
        finalCodigoCliente = newClient.codigoCliente;
    }
  }

  // 3. B. Gestión de Catálogo
  const processedItems = [...items];
  for (let i = 0; i < processedItems.length; i++) {
    const item = processedItems[i];
    const isManual = item.source === 'manual' || item.isCustom === true || !item.productId;
    if (isManual && item.codigo && item.descripcion && (item.isNewLine || item.isEdited)) {
        const codeMatch = catalogMap.byCode.get(item.codigo.trim().toUpperCase());
        if (!codeMatch) {
            const newProduct: Product = {
                id: '',
                codigo: item.codigo.trim().toUpperCase(),
                nombre: item.descripcion.trim(),
                precioBase: item.precioUnitario,
                isActive: true,
                moneda: metaData.moneda
            };
            const savedProd = await addProduct(newProduct);
            processedItems[i] = { ...item, productId: savedProd.id, isCustom: false, source: 'catalog' };
        } else {
            processedItems[i] = { ...item, productId: codeMatch.id, isCustom: false, source: 'catalog' };
        }
    }
  }

  // 5. D. Attachment Movement Logic (DEPRECATED - need to verify if this is still needed with UUIDs)
  // If docId changes, this needs handling. 
  
  // 6. E. Final Persistence
  const quoteData: any = {
    id: finalQuoteId, // Mantener para compatibilidad en UI
    visualQuoteNumber, // Nuevo campo visual
    fecha,
    year,
    month,
    estado: quote?.estado || 'Pendiente',
    empresa: clientData.empresa.trim(),
    contacto: clientData.contacto.trim(),
    telefono: clientData.telefono.trim(),
    correo: clientData.correo.trim(),
    codigoCliente: finalCodigoCliente,
    items: processedItems.map(item => ({
        ...item,
        isNewLine: false,
        isEdited: false
    })),
    moneda: metaData.moneda,
    descuento: metaData.descuento,
    formaPago: metaData.formaPago,
    vigencia: metaData.vigencia,
    observaciones: metaData.notas,
    monto: total,
    applyTax: applyTax,
    montoLetras: quote?.montoLetras || 'Monto autocalculado al imprimir',
    ordenes: quote?.ordenes || [],
    facturas: quote?.facturas || [],
    isDeleted: quote?.isDeleted || false,
    createdAt: quote?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try { JSON.stringify(quoteData); } catch (e) {
    throw new Error("No se puede guardar la cotización: contiene referencias circulares.");
  }
  
  if (isNewQuote) {
      await setVersionedDocOffline("quotes", docId, quoteData);
  } else {
      await updateVersionedDocOffline("quotes", docId, quoteData);
  }

  auditService.logEvent({
    action: isNewQuote ? 'create_record' : 'update_record',
    module: 'Cotizaciones',
    submodule: 'Cotización',
    route: '/cotizaciones',
    recordId: docId,
    recordCode: finalQuoteId
  });
  
  return { ...quoteData, docId };
} finally {
  inFlightSaves.delete(saveKey);
}
};

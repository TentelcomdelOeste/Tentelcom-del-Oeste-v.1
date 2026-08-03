import { CashflowEntry } from '../../../../utils/types';
import { ImportResult, ImportProgress } from '../types';
import { db } from '../../../../../firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { User } from '../../../../utils/types';

export class CashflowBatchImporter {
  /**
   * Responsibility: Execute the final import using Firestore writeBatch.
   */
  async import(
    entries: Partial<CashflowEntry>[], 
    currentUser: User, 
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    console.log('[CashflowBatchImporter] Importing entries count:', entries.length);
    
    if (!currentUser) {
      throw new Error("Usuario no autenticado");
    }

    const BATCH_SIZE = 450; // Safe limit below 500
    const totalBatches = Math.ceil(entries.length / BATCH_SIZE);
    
    let processed = 0;
    const errors: any[] = [];

    const cashflowRef = collection(db, "cashflow_entries");

    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEntries = entries.slice(batchStart, batchStart + BATCH_SIZE);
      const batch = writeBatch(db);

      batchEntries.forEach(entry => {
        // Sanitize entry just like in manual creation
        const sanitizedData = { ...entry } as any;
        
        if (sanitizedData.invoice === undefined || sanitizedData.invoice === '') {
            sanitizedData.invoice = null;
        }
        
        Object.keys(sanitizedData).forEach(key => {
            if (sanitizedData[key] === undefined) {
                sanitizedData[key] = null;
            }
        });

        const newEntryPayload = {
          ...sanitizedData,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString()
        };

        const newDocRef = doc(cashflowRef);
        batch.set(newDocRef, newEntryPayload);
      });

      try {
        await batch.commit();
        processed += batchEntries.length;
        
        if (onProgress) {
          onProgress({
            total: entries.length,
            processed,
            currentBatch: i + 1,
            totalBatches,
            percentage: Math.round((processed / entries.length) * 100)
          });
        }
      } catch (err: any) {
        console.error(`[CashflowBatchImporter] Error in batch ${i + 1}:`, err);
        errors.push({
          row: 0,
          column: 'Global',
          message: `Error al procesar el lote ${i + 1}: ${err.message}`
        });
        
        // Stop on first batch failure to prevent partial duplicate imports on retry
        break;
      }
    }

    return {
      success: errors.length === 0,
      statistics: {
        processed: entries.length,
        imported: processed,
        failed: entries.length - processed,
        skipped: 0 // Skipped should be handled before passing to importer
      },
      errors
    };
  }
}

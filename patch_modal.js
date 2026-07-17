const fs = require('fs');
let code = fs.readFileSync('modules/core/imports/components/ImportWizardModal.tsx', 'utf8');

// 1. Add imports
code = code.replace(
    `import { ImportedConversationEvent } from '../types';`,
    `import { ImportedConversationEvent } from '../types';\nimport { db } from '@/firebase';\nimport { writeBatch, doc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';\nimport { mapImportedEventToTimelineEvent } from '../mappers/timelineMapper';`
);

// 2. Add Props
code = code.replace(
    `interface Props {\n  show: boolean;\n  onClose: () => void;\n}`,
    `interface Props {\n  show: boolean;\n  onClose: () => void;\n  resolvedTimelineId?: string;\n  activeParentId?: string;\n  currentCollection?: string;\n  currentUser?: { id: string; name: string };\n}`
);

// 3. Destructure Props
code = code.replace(
    `export const ImportWizardModal: React.FC<Props> = ({ show, onClose }) => {`,
    `export const ImportWizardModal: React.FC<Props> = ({ show, onClose, resolvedTimelineId, activeParentId, currentCollection, currentUser }) => {`
);

// 4. Add State
code = code.replace(
    `const [error, setError] = useState<string | null>(null);`,
    `const [error, setError] = useState<string | null>(null);\n  const [importStats, setImportStats] = useState<{ imported: number, omitted: number, timeMs: number } | null>(null);`
);

// 5. Add handleImport method
const importMethod = `
  const handleImport = async () => {
    setIsProcessing(true);
    setError(null);
    const startTime = performance.now();

    try {
        const basePath = resolvedTimelineId
          ? \`operational_timelines/\${resolvedTimelineId}/events\`
          : \`\${currentCollection}/\${activeParentId}/timeline\`;
        
        // Load existing whatsapp fingerprints
        let existingIds = new Set<string>();
        try {
            const q = query(collection(db, basePath), where("source", "==", "whatsapp"));
            const snap = await getDocs(q);
            snap.forEach(d => existingIds.add(d.id));
        } catch(e) {
            console.warn("Could not load existing whatsapp events for deduplication", e);
        }

        const batchChunks = [];
        let currentBatch = writeBatch(db);
        let currentBatchCount = 0;
        let imported = 0;
        let omitted = 0;

        for (let i = 0; i < parsedEvents.length; i++) {
            const ev = parsedEvents[i];
            const msgSnippet = ev.message.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
            const authorSnippet = ev.author.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
            const fingerprint = \`wa_\${ev.timestamp.getTime()}_\${authorSnippet}_\${msgSnippet}\`;

            if (existingIds.has(fingerprint)) {
                omitted++;
                continue;
            }

            const tEv = mapImportedEventToTimelineEvent(
                ev,
                currentUser?.id || 'unknown',
                currentUser?.name || 'Unknown'
            );
            tEv.id = fingerprint;
            tEv.progress = 100;
            // No isOptimistic needed since it's going to firestore directly

            const docRef = doc(db, basePath, fingerprint);
            currentBatch.set(docRef, tEv, { merge: true });
            currentBatchCount++;
            imported++;
            existingIds.add(fingerprint); // avoid duplicates in the same file

            if (currentBatchCount >= 400) {
                batchChunks.push(currentBatch);
                currentBatch = writeBatch(db);
                currentBatchCount = 0;
            }
        }

        if (currentBatchCount > 0) {
            batchChunks.push(currentBatch);
        }

        // Execute all batches
        for (const b of batchChunks) {
            await b.commit();
        }

        // Record import event
        if (imported > 0) {
            try {
                const importId = \`import_\${Date.now()}\`;
                const importLogPath = resolvedTimelineId 
                    ? \`operational_timelines/\${resolvedTimelineId}/imports\` 
                    : \`\${currentCollection}/\${activeParentId}/imports\`;
                
                await setDoc(doc(db, importLogPath, importId), {
                    importId,
                    fechaImportacion: new Date().toISOString(),
                    usuario: currentUser?.name || 'Unknown',
                    cantidadMensajes: imported,
                    nombreChat: parsedEvents[0]?.metadata?.chatName || "Desconocido",
                    rangoFechas: getSummary()
                });
            } catch(e) { console.warn(e); }
        }

        const endTime = performance.now();
        setImportStats({
            imported,
            omitted,
            timeMs: Math.round(endTime - startTime)
        });
        setStep(5);

    } catch(err: any) {
        setError(\`Error durante la importación: \${err.message}\`);
    } finally {
        setIsProcessing(false);
    }
  };
`;

code = code.replace(`const getSummary = () => {`, importMethod + `\n  const getSummary = () => {`);

// 6. Update handleNext
code = code.replace(
    `    } else if (step === 4) {\n      // Phase 3B will actually do the import, for now we just close or show a message.\n      onClose();\n    } else {`,
    `    } else if (step === 4) {\n      handleImport();\n    } else if (step === 5) {\n      onClose();\n    } else {`
);

// 7. Add step 5 in renderStep
const step5 = `
      case 5:
        return (
          <div className="space-y-6 text-center py-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <FiCheckCircle className="w-10 h-10 text-blue-600" />
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Importación Completada</h3>
                <p className="text-sm font-bold text-slate-500 mb-6">
                    El proceso ha finalizado correctamente.
                </p>
                
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 gap-4 text-left">
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Mensajes Importados</p>
                        <p className="text-xl font-black text-blue-600">{importStats?.imported}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Omitidos (Duplicados)</p>
                        <p className="text-xl font-black text-slate-600">{importStats?.omitted}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tiempo de procesamiento</p>
                        <p className="text-sm font-bold text-slate-600">{((importStats?.timeMs || 0) / 1000).toFixed(2)} segundos</p>
                    </div>
                </div>
            </div>
          </div>
        );
`;
code = code.replace(`      default:\n        return null;`, step5 + `\n      default:\n        return null;`);

fs.writeFileSync('modules/core/imports/components/ImportWizardModal.tsx', code);

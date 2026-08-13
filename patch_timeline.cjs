const fs = require('fs');
const file = 'modules/core/SharedTimeline/SharedTimelineView.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = '    const fetchAllMetadata = async () => {';
const endStr = '    fetchAllMetadata();\n  }, [activeParentId, trabajoId, currentCollection]);';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find fetchAllMetadata!");
  process.exit(1);
}

const replacement = `    const fetchAllMetadata = async () => {
      const currentTimelineId = resolvedTimelineIdRef.current;
      const startTime = performance.now();
      console.log("[TRACE][SharedTimeline] fetchAllMetadata STARTED", { activeParentId, currentTimelineId });
      
      try {
        let newContext: OperationalContext = {
          jobTitle: metadataRef.current?.title || "Bitácora Sin Título",
          jobStatus: metadataRef.current?.status || "",
          jobLocation: metadataRef.current?.subtitle || "",
          jobOt: "",
          vehicleName: "",
          details: null,
          linkedLog: null,
          trabajoId: trabajoId || null,
          isLoading: true
        };
        
        let finalTimelineId = currentTimelineId || activeParentId || "";

        if (activeParentId && currentCollection) {
          const docRef = doc(db, currentCollection, activeParentId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            finalTimelineId = data.timelineId || data.id || finalTimelineId;

            if (currentCollection === 'trabajos') {
              newContext = {
                ...newContext,
                details: data,
                jobTitle: data.titulo || data.tipo_trabajo || "Trabajo sin título",
                jobStatus: data.estado || "programado",
                jobLocation: data.ubicacion || "",
                jobOt: data.otCode || ""
              };
            } else if (currentCollection === 'bitacora_vehiculos') {
              const resolvedDriverName = (() => {
                if (!data.conductorName || data.conductorName.includes("@") || data.conductorName === data.conductorId) {
                  const emp = employees?.find(e => e?.id === data.conductorId);
                  return emp ? (emp.name || emp.username || "Sin nombre") : (data.conductorName || "Sin nombre");
                }
                return data.conductorName;
              })();
              
              const vehicleUnit = data.unidad || data.unidadName || "Vehículo sin unidad";
              const vehiclePlaca = data.placa || "";
              const defaultSubtitle = \`\${vehiclePlaca ? vehiclePlaca + " - " : ""}\${resolvedDriverName}\`;

              newContext = {
                ...newContext,
                details: data,
                jobTitle: metadataRef.current?.title || \`Bitácora de Salida: \${vehicleUnit}\`,
                jobStatus: data.horaLlegada ? "FINALIZADA" : "EN RUTA",
                jobLocation: metadataRef.current?.subtitle || defaultSubtitle || data.destino || "Sin destino",
                vehicleName: data.unidadName || data.unidadId || "",
                trabajoId: data.trabajoId || null
              };
            }
          }
        } else if (currentTimelineId) {
            const tlRef = doc(db, "operational_timelines", currentTimelineId);
            const tlSnap = await getDoc(tlRef);
            if (tlSnap.exists()) {
                const tlMeta = tlSnap.data().metadata || {};
                newContext = {
                    ...newContext,
                    details: tlSnap.data(),
                    jobTitle: tlMeta.title || tlMeta.unidad || "Canal de Comunicación",
                    jobStatus: tlMeta.status || "en_proceso",
                    jobLocation: tlMeta.subtitle || tlMeta.destino || "Ubicación de Campo",
                    vehicleName: tlMeta.unidad || ""
                };
            }
        }

        if (finalTimelineId && finalTimelineId !== resolvedTimelineIdRef.current) {
          console.log(\`[TRACE][SharedTimeline] Resolved timelineId to: \${finalTimelineId}\`);
          setResolvedTimelineId(finalTimelineId);
        }

        setContext(prev => ({ ...prev, ...newContext, isLoading: false }));
        console.log(\`[TRACE][SharedTimeline] Metadata flow COMPLETED in \${Math.round(performance.now() - startTime)}ms\`);
      } catch (e) {
        console.error("Error fetching operational metadata:", e);
        setContext(prev => ({ ...prev, isLoading: false }));
      }
    };
    fetchAllMetadata();
  }, [activeParentId, trabajoId, currentCollection]);`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log("Patched SharedTimelineView.tsx");

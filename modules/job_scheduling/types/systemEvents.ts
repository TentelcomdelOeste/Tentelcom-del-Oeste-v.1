export interface SystemEventPayload {
  id: string;
  tipo: "system_event";
  systemAction: "bitacora_iniciada" | "bitacora_vinculada" | "bitacora_desvinculada" | "bitacora_finalizada" | "bitacora_recarga_combustible" | "bitacora_actualizada";
  timestamp: any;
  metadata: Record<string, any> & {
    fechaHora: string;
    descripcion: string;
  };
}

import { SystemEventPayload } from "../types/systemEvents";

export const createSystemEventPayload = (
  timelineId: string,
  action: SystemEventPayload['systemAction'],
  metadata: SystemEventPayload['metadata'],
  overrideTimestamp?: Date
) => {
  const now = overrideTimestamp || new Date();
  
  // Safe UUID generation for environments where crypto.randomUUID might not be available
  const safeUuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  const clientGeneratedId = `evt_${action}_${now.getTime()}_${safeUuid()}`;
  
  return {
    id: clientGeneratedId,
    clientGeneratedId: clientGeneratedId,
    optimisticId: clientGeneratedId,
    tipo: "system_event",
    systemAction: action,
    timestamp: now.toISOString(), // Ensure timestamp is present and correctly valued
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    createdLocallyAt: now.toISOString(),
    pendingSync: true,
    optimistic: true,
    timelineId: timelineId,
    systemEventType: action,
    metadata: metadata,
    source: "optimistic-ui"
  };
};

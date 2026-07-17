import { TimelineEvent } from "@/modules/job_scheduling/types";
import { eventBus } from "@/modules/core/eventBus";

type Listener = () => void;
const listeners = new Set<Listener>();

// Map of timelineId -> TimelineEvent[]
const PERSISTENCE_KEY = 'tentelcom_optimistic_timeline_events';

const loadFromStorage = (): Map<string, TimelineEvent[]> => {
  try {
    const saved = localStorage.getItem(PERSISTENCE_KEY);
    if (!saved) return new Map();
    const parsed = JSON.parse(saved);
    // Convert array of [key, value] back to Map if stored as such, or handle object
    if (Array.isArray(parsed)) {
      return new Map(parsed);
    }
    return new Map(Object.entries(parsed));
  } catch (err) {
    console.warn("[optimisticEventsStore] Error loading from storage:", err);
    return new Map();
  }
};

const saveToStorage = (data: Map<string, TimelineEvent[]>) => {
  try {
    const toSave = Array.from(data.entries());
    localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn("[optimisticEventsStore] Error saving to storage:", err);
  }
};

const optimisticCommentsByTimeline = loadFromStorage();

export const getOptimisticComments = (timelineId: string): TimelineEvent[] => {
  if (!timelineId) return [];
  return optimisticCommentsByTimeline.get(timelineId) || [];
};

export const addOptimisticComment = (timelineId: string, comment: TimelineEvent) => {
  if (!timelineId) return;
  const current = getOptimisticComments(timelineId);
  // Avoid duplicates
  if (!current.find((c) => c.id === comment.id)) {
      optimisticCommentsByTimeline.set(timelineId, [...current, comment]);
      saveToStorage(optimisticCommentsByTimeline);
      notifyListeners();
  }
};

export const replaceAllOptimisticComments = (timelineId: string, comments: TimelineEvent[]) => {
  if (!timelineId) return;
  optimisticCommentsByTimeline.set(timelineId, comments);
  saveToStorage(optimisticCommentsByTimeline);
  notifyListeners();
};

export const removeOptimisticComment = (timelineId: string, eventId: string) => {
  if (!timelineId) return;
  const current = getOptimisticComments(timelineId);
  const filtered = current.filter(c => c.id !== eventId);
  if (filtered.length !== current.length) {
    optimisticCommentsByTimeline.set(timelineId, filtered);
    saveToStorage(optimisticCommentsByTimeline);
    notifyListeners();
  }
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeOptimisticComments = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Listen globally to eventBus so we don't depend on components being mounted
if (!(window as any).__optimisticEventsStoreInitialized) {
  (window as any).__optimisticEventsStoreInitialized = true;
  eventBus.subscribe('SYSTEM_EVENT_CREATED', (payload: any) => {
      const tid = payload.timelineId;
      if (tid) {
        const enrichedEvent = { 
          ...payload.payload, 
          id: payload.payload.clientGeneratedId || payload.payload.optimisticId || payload.payload.id,
          tipo: "system_event",
          isOptimistic: true 
        } as TimelineEvent;
        
        console.log("[TRACE][optimisticEventsStore] Captured system event globally:", enrichedEvent.id);
        addOptimisticComment(tid, enrichedEvent);
      }
  });
}

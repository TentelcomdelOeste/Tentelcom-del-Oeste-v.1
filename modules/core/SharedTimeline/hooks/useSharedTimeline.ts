import { useState, useEffect, useMemo, RefObject } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  startAfter,
  where,
  DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase";
import { TimelineEvent } from "@/modules/job_scheduling/types";
import { useAuth } from "@/hooks/useAuth";
import { removeOptimisticComment } from '../optimisticEventsStore';
import { useLocalCollection } from "@/hooks/useLocalCollection";

export function useLogTimeline(
  parentId: string,
  optimisticComments: any[],
  scrollRef?: RefObject<HTMLDivElement>,
  parentCollection: string = "trabajos",
  timelineId?: string
) {
  const { authReady, currentUser } = useAuth();
  
  const unifiedPath = useMemo(() => {
    if (!timelineId) return null;
    return `operational_timelines/${timelineId}/events`;
  }, [timelineId]);

  const legacyPath = useMemo(() => {
    if (!parentId || !parentCollection) return null;
    return `${parentCollection}/${parentId}/timeline`;
  }, [parentId, parentCollection]);

  // Read both local collections for optimistic/offline
  const localUnifiedEvents = useLocalCollection(unifiedPath || "__null__");
  const localLegacyEvents = useLocalCollection(legacyPath || "__null__");
  
  const localEvents = useMemo(() => {
    return [...localUnifiedEvents, ...localLegacyEvents];
  }, [localUnifiedEvents, localLegacyEvents]);
  
  // efficient reconciliation Map
  const [realtimeComments, setRealtimeComments] = useState<TimelineEvent[]>([]);

  // Cleanup optimistic comments that are already synced
  useEffect(() => {
    if (realtimeComments.length > 0 && optimisticComments.length > 0 && (timelineId || parentId)) {
      const activeTid = (timelineId || parentId)!;
      optimisticComments.forEach(opt => {
        const optId = opt.optimisticId || (opt as any).clientGeneratedId || opt.id;
        const existsInRealtime = realtimeComments.some(rtc => 
          rtc.id === optId || (rtc as any).optimisticId === optId || (rtc as any).clientGeneratedId === optId
        );
        
        if (existsInRealtime) {
          console.log(`[TRACE][useLogTimeline] Sync detected for ${optId}, removing from optimistic store.`);
          removeOptimisticComment(activeTid, opt.id);
        }
      });
    }
  }, [realtimeComments, optimisticComments, timelineId, parentId]);

  const [historicalComments, setHistoricalComments] = useState<TimelineEvent[]>([]);
  
  const [oldestRealtimeDoc, setOldestRealtimeDoc] = useState<DocumentSnapshot | null>(null);
  const [lastDocSnapshot, setLastDocSnapshot] = useState<DocumentSnapshot | null>(null);
  
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pinnedComments, setPinnedComments] = useState<TimelineEvent[]>([]);

  // Snapshot Listeners for Multi-source Collections (Pinned & Recent)
  useEffect(() => {
    console.log("[TRACE][useSharedTimeline] EFFECT START");
    if (!authReady || !currentUser) return;
    if (!parentId && !timelineId) return;

    let mounted = true;
    const startTime = performance.now();
    console.log("[TRACE][LogTimeline] LISTENER START", { parentId, timelineId });

    // Reset state for new setup
    setRealtimeComments([]);
    setHistoricalComments([]);
    setPinnedComments([]);
    setOldestRealtimeDoc(null);
    setLastDocSnapshot(null);
    setHasMore(true);

    const sources = [];
    if (unifiedPath) sources.push(collection(db, unifiedPath));
    if (legacyPath && legacyPath !== unifiedPath) sources.push(collection(db, legacyPath));
    
    if (sources.length === 0) return;

    const unsubs: (() => void)[] = [];

    sources.forEach(sourceRef => {
      // 1. Pinned Listener
      const pinnedQuery = query(sourceRef, where("pinned", "==", true));
      unsubs.push(onSnapshot(
        pinnedQuery,
        (snapshot) => {
          if (!mounted) return;
          const pinnedList: TimelineEvent[] = [];
          snapshot.forEach((doc) => {
            if (!doc.data({ serverTimestamps: 'estimate' }).eliminado) {
              pinnedList.push({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) } as TimelineEvent);
            }
          });
          setPinnedComments(prev => {
             const merged = [...prev.filter(p => !pinnedList.find(i => i.id === p.id)), ...pinnedList];
             return merged;
          });
        },
        (error) => console.error("[LogTimeline] Error listening to pinned messages:", error)
      ));

      // 2. Main Real-time Listener limit(50)
      // Usamos createdAt como orden primario por mayor confiabilidad (siempre existe en versionControl)
      const q = query(sourceRef, orderBy("createdAt", "desc"), limit(50));
      unsubs.push(onSnapshot(
        q,
        (snapshot) => {
          if (!mounted) return;
          const latency = performance.now() - startTime;
          // Silenced verbose snapshots trace to prevent flickering logs
          // console.log(`[TRACE][LogTimeline] Snapshot ARRIVED (${snapshot.size} docs from ${sourceRef.id})`);
          
          const items: TimelineEvent[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data({ serverTimestamps: 'estimate' });
            items.push({ id: doc.id, ...data } as TimelineEvent);
          });

          setRealtimeComments(prev => {
             const merged = [...prev.filter(p => !items.find(i => i.id === p.id)), ...items];
             return merged;
          });

          const docs = snapshot.docs;
          if (docs.length > 0 && sourceRef.path.includes('operational_timelines')) {
            setOldestRealtimeDoc(docs[docs.length - 1]);
          }

          if (docs.length < 50 && sourceRef.path.includes('operational_timelines')) {
            setHasMore(false);
          }
        },
        (error) => {
           console.error(`[LogTimeline] Error listening to ${sourceRef.path}:`, error);
           // Fallback if index missing for createdAt
           if (error.message.includes('index')) {
              console.warn("[LogTimeline] Falling back to unordered query due to missing index");
              const fallbackQ = query(sourceRef, limit(50));
              const unsubFallback = onSnapshot(fallbackQ, (snap) => {
                 const items: TimelineEvent[] = [];
                 snap.forEach(d => items.push({ id: d.id, ...d.data() } as TimelineEvent));
                 setRealtimeComments(prev => [...prev.filter(p => !items.find(i => i.id === p.id)), ...items]);
              });
              unsubs.push(unsubFallback);
           }
        }
      ));
    });

    // 3. Fallback Listener para system_events global (por si acaso quedaron huérfanos allí)
    const globalEventsRef = collection(db, 'system_events');
    const qGlobal = query(globalEventsRef, where('parentId', '==', parentId), limit(20));
    unsubs.push(onSnapshot(qGlobal, (snap) => {
        if (!mounted || snap.empty) return;
        const items: TimelineEvent[] = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() } as TimelineEvent));
        setRealtimeComments(prev => {
            const merged = [...prev.filter(p => !items.find(i => i.id === p.id)), ...items];
            return merged;
        });
    }, (err) => console.warn("[LogTimeline] Global fallback listener failed:", err)));

    return () => {
      console.log("[TRACE][useSharedTimeline] EFFECT CLEANUP");
      console.log("[TRACE][LogTimeline] LISTENER DETACH", { parentId, timelineId });
      mounted = false;
      unsubs.forEach(fn => fn());
    };
  }, [authReady, currentUser?.id || currentUser?.uid, parentId, parentCollection, timelineId, legacyPath, unifiedPath]);

  // 3. Load More / cursor-based pagination query
  const loadMore = async () => {
    if (isLoadingMore || !hasMore || (!parentId && !timelineId)) return;
    setIsLoadingMore(true);

    try {
      const cursor = lastDocSnapshot || oldestRealtimeDoc;
      if (!cursor) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const timelineRef = timelineId
        ? collection(db, "operational_timelines", timelineId, "events")
        : collection(db, parentCollection, parentId, "timeline");
      const historyQ = query(
        timelineRef,
        orderBy("createdAt", "desc"), // Consistent with main listener
        startAfter(cursor),
        limit(50)
      );

      const snapshot = await getDocs(historyQ);
      const items: TimelineEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data({ serverTimestamps: 'estimate' });
        items.push({ id: doc.id, ...data } as TimelineEvent);
      });

      if (items.length < 50) {
        setHasMore(false);
      }

      const docs = snapshot.docs;
      if (docs.length > 0) {
        setLastDocSnapshot(docs[docs.length - 1]);
      }

      setHistoricalComments((prev) => [...prev, ...items]);
    } catch (error) {
      console.error("Error paginating timeline:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Merge everything uniquely using a Map - Stable computation
  const mergedCommentsMap = useMemo(() => {
    const map = new Map<string, TimelineEvent>();
    const reconciliationMap = new Map<string, string>();
    
    // Process firestore data - they are already sorted DESC by Firestore query
    // We combine historical and realtime. Realtime contains the latest 50.
    const allFirestore = [...historicalComments, ...realtimeComments];
    
    for (const c of allFirestore) {
      if (!c.source) c.source = "system";
      map.set(c.id, c);
      const optId = (c as any).optimisticId || (c as any).clientGeneratedId;
      if (optId) reconciliationMap.set(optId, c.id);
    }

    // 2. Process local documents from unified architecture (SQLite)
    // These take precedence over standard Firestore if they are "dirty"
    for (const ld of localEvents) {
      const eventId = ld.docId;
      const data = ld.data as any;
      if (!data.source) data.source = "system";
      
      const existing = map.get(eventId);
      // We use isDirty or !existing to ensure local changes are visible during sync
      if (!existing || ld.isDirty) {
        map.set(eventId, { ...data, id: eventId } as TimelineEvent);
        const optId = (data as any).optimisticId || (data as any).clientGeneratedId;
        if (optId) reconciliationMap.set(optId, eventId);
      }
    }
    
    // 3. Add temporary in-memory optimistic comments if not yet in SQLite or Firestore
    for (const opt of optimisticComments) {
      if (!opt.source) opt.source = "system";
      const optId = opt.optimisticId || (opt as any).clientGeneratedId || opt.id;
      if (!reconciliationMap.has(optId)) {
        map.set(opt.id, opt);
      }
    }

    return map;
  }, [realtimeComments, historicalComments, optimisticComments, localEvents]);

  // Efficient chronological sorting - Only redo if map size or content changes
  const mergedComments = useMemo(() => {
    const startTime = performance.now();
    const sorted = Array.from(mergedCommentsMap.values()).sort((a, b) => {
      const getTime = (evt: TimelineEvent) => {
        const ts = evt.timestamp;
        if (ts) {
            if (ts.seconds !== undefined) return ts.seconds * 1000;
            if (typeof ts.toDate === 'function') return ts.toDate().getTime();
            if (ts instanceof Date) return ts.getTime();
            if (typeof ts === 'number') return ts;
            if (typeof ts === 'string') {
              const d = new Date(ts);
              return isNaN(d.getTime()) ? 0 : d.getTime();
            }
        }
        
        // Fallbacks
        if (evt.createdAtMs) return evt.createdAtMs;
        if (evt.createdAt) {
            const d = new Date(evt.createdAt);
            if (!isNaN(d.getTime())) return d.getTime();
        }
        
        // Final fallback: Use current time for newly created optimistic logs without any timestamp yet
        return Date.now();
      };
      
      const timeA = getTime(a);
      const timeB = getTime(b);

      // Sort Ascending (for bottom-to-top read) or based on UI needs
      // Usually SharedTimeline sorts chronologically correctly
      return timeA - timeB;
    });
    
    // console.log(`[TRACE][useSharedTimeline] Sorting ${sorted.length} items took ${Math.round(performance.now() - startTime)}ms`);
    return sorted;
  }, [mergedCommentsMap]);

  // Compute latest pinned using our explicit real-time pinned listener
  const latestPinned = useMemo(() => {
    if (pinnedComments.length === 0) return null;
    return [...pinnedComments].sort((a, b) => {
      const getMs = (ts: any) => {
        if (!ts) return 0;
        if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate().getTime();
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === 'number') return ts;
        if (typeof ts === 'string') {
          const d = new Date(ts);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        if (ts.seconds !== undefined) return ts.seconds * 1000;
        return 0;
      };
      return getMs(b.pinnedAt) - getMs(a.pinnedAt);
    })[0];
  }, [pinnedComments]);

  return {
    comments: realtimeComments,
    mergedComments,
    mergedCommentsMap,
    pinnedComments,
    latestPinned,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

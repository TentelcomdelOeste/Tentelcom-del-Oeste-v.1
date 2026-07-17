import { useState, useEffect, useCallback } from 'react';
import { fetchAnalyticsEvents, AnalyticsEvent } from '../services/webAnalysisService';
import { QueryDocumentSnapshot } from 'firebase/firestore';

export const useWebAnalysis = () => {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);

  const loadMore = useCallback(async () => {
    if (loading && events.length > 0) return; // Prevent concurrent loads
    
    setLoading(true);
    try {
      const { events: newEvents, lastVisible: newLast } = await fetchAnalyticsEvents(lastVisible);
      
      if (newEvents.length === 0) {
        setHasMore(false);
      } else {
        setEvents(prev => [...prev, ...newEvents]);
        setLastVisible(newLast);
      }
    } catch (error) {
      console.error("Error fetching analytics events:", error);
    } finally {
      setLoading(false);
    }
  }, [lastVisible, loading, events.length]);

  // Initial load
  useEffect(() => {
    loadMore();
  }, []);

  return { events, loading, hasMore, loadMore };
};

import { useState, useEffect, useCallback } from 'react';
import { TimelineEvent } from "@/modules/job_scheduling/types";
import { getOptimisticComments, subscribeOptimisticComments, addOptimisticComment as addGlobalOptimisticComment, replaceAllOptimisticComments } from '../optimisticEventsStore';

export const useOptimisticComments = (timelineId: string | undefined) => {
  const [comments, setComments] = useState<TimelineEvent[]>(
    timelineId ? getOptimisticComments(timelineId) : []
  );

  useEffect(() => {
    if (!timelineId) {
      setComments([]);
      return;
    }
    
    // Initial hydration
    setComments(getOptimisticComments(timelineId));
    
    // Subscribe to store updates
    const unsubscribe = subscribeOptimisticComments(() => {
      setComments(getOptimisticComments(timelineId));
    });
    
    return unsubscribe;
  }, [timelineId]);

  const addOptimisticComment = useCallback((comment: TimelineEvent) => {
    if (!timelineId) return;
    addGlobalOptimisticComment(timelineId, comment);
  }, [timelineId]);

  const setOptimisticComments = useCallback((updater: (prev: TimelineEvent[]) => TimelineEvent[]) => {
    if (!timelineId) return;
    const current = getOptimisticComments(timelineId);
    const updated = updater(current);
    replaceAllOptimisticComments(timelineId, updated);
  }, [timelineId]);

  return {
    optimisticComments: comments,
    addOptimisticComment,
    setOptimisticComments
  };
};

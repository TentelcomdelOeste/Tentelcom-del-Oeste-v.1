import { useEffect, useRef } from 'react';
import { auditService } from '../services/auditService';
import { useUserContext } from '../contexts/UserContext';
import { useLocation } from 'react-router-dom';

export function useAuditPermanence(params: {
  module: string;
  submodule: string;
  recordId?: string;
  recordCode?: string;
  enabled?: boolean;
}) {
  const { currentUser } = useUserContext();
  const location = useLocation();
  const entryTimeRef = useRef<number>(Date.now());
  const { module, submodule, recordId, recordCode, enabled = true } = params;

  useEffect(() => {
    if (!enabled || !currentUser?.uid) return;

    entryTimeRef.current = Date.now();

    // Log the actual view action immediately (view_record)
    auditService.logEvent({
      userId: currentUser.id || currentUser.uid,
      userName: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      action: 'view_record',
      module,
      submodule,
      route: location.pathname,
      recordId,
      recordCode
    });

    return () => {
      const durationSeconds = Math.floor((Date.now() - entryTimeRef.current) / 1000);
      
      auditService.logEvent({
        userId: currentUser.id || currentUser.uid,
        userName: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        action: 'record_permanence',
        module,
        submodule,
        route: location.pathname,
        durationSeconds,
        recordId,
        recordCode
      });
    };
  }, [enabled, currentUser?.uid, currentUser?.name, currentUser?.email, currentUser?.role, module, submodule, recordId, recordCode, location.pathname]);
}

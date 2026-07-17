import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { AuditLog, AuditAction } from '../types/audit.types';

const COLLECTION_NAME = 'system_access_logs';

class AuditService {
  private lastLoggedModule: string | null = null;
  private lastLoggedTimestamp: number = 0;
  private sessionId: string;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateSessionId(): string {
    let sid = sessionStorage.getItem('audit_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('audit_session_id', sid);
    }
    return sid;
  }

  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    let b = "Unknown";
    if (ua.indexOf("Firefox") > -1) b = "Firefox";
    else if (ua.indexOf("SamsungBrowser") > -1) b = "Samsung Browser";
    else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) b = "Opera";
    else if (ua.indexOf("Trident") > -1) b = "Internet Explorer";
    else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) b = "Edge";
    else if (ua.indexOf("Chrome") > -1) b = "Chrome";
    else if (ua.indexOf("Safari") > -1) b = "Safari";
    return b;
  }

  private getOSInfo(): string {
    const ua = navigator.userAgent;
    let os = "Unknown";
    if (ua.indexOf("Windows") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "MacOS";
    else if (ua.indexOf("X11") > -1) os = "Linux";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("iPhone") > -1) os = "iOS";
    return os;
  }

  private getCachedUser() {
    try {
      const raw = localStorage.getItem('tentelcom_user_session');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async logEvent(params: {
    userId?: string;
    userName?: string;
    email?: string;
    role?: string;
    action: AuditAction;
    module: string;
    submodule?: string;
    route: string;
    durationSeconds?: number;
    recordId?: string;
    recordCode?: string;
  }) {
    const now = Date.now();
    const user = (params.userId && params.userName) ? params : this.getCachedUser();

    if (!user) return; // Skip if no user context available

    // Anti-duplication logic for navigation
    if (params.action === 'ingreso_modulo' || params.action === 'cambio_modulo') {
      if (this.lastLoggedModule === params.module && (now - this.lastLoggedTimestamp) < 5000) {
        return; // Skip if same module within 5 seconds (debounce)
      }
      this.lastLoggedModule = params.module;
      this.lastLoggedTimestamp = now;
    }

    // Mandatory optimization: Ignore stays < 5 seconds for permanence events
    if ((params.action === 'module_permanence' || params.action === 'record_permanence') && params.durationSeconds !== undefined) {
      if (params.durationSeconds < 5) return;
    }

    try {
      await addDoc(collection(db, COLLECTION_NAME), {
        userId: user.userId || user.id || user.uid,
        userName: user.userName || user.name || user.email || 'Unknown',
        email: user.email || '',
        role: user.role || 'user',
        action: params.action,
        module: params.module,
        submodule: params.submodule || '',
        route: params.route,
        timestamp: serverTimestamp(),
        browser: this.getBrowserInfo(),
        operatingSystem: this.getOSInfo(),
        onlineStatus: navigator.onLine,
        sessionId: this.sessionId,
        durationSeconds: params.durationSeconds || null,
        durationMinutes: params.durationSeconds ? Number((params.durationSeconds / 60).toFixed(2)) : null,
        recordId: params.recordId || null,
        recordCode: params.recordCode || null
      });
    } catch (error: any) {
      if (error.code === 'already-exists') {
        console.warn('Audit log collision (skipping):', error);
      } else {
        console.error('Error logging audit event:', error, 'Params:', params);
      }
    }
  }

  async getLogs(filters?: {
    userId?: string;
    module?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    let q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'), limit(500));

    // Firestore allows multiple where clauses but limited inequality on single field
    // For simplicity we return latest 500 and filter more in memory if needed or build specific queries
    // Here we'll just implement the common filters
    
    if (filters?.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    if (filters?.module) {
      q = query(q, where('module', '==', filters.module));
    }
    if (filters?.action) {
      q = query(q, where('action', '==', filters.action));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AuditLog[];
  }

  // Retention policy: 12 months cleanup
  async cleanupOldLogs() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('timestamp', '<', Timestamp.fromDate(twelveMonthsAgo)),
      limit(500) // Process in chunks
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
      batch.delete(d.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} old audit logs.`);
  }

  getSessionId() {
    return this.sessionId;
  }
}

export const auditService = new AuditService();

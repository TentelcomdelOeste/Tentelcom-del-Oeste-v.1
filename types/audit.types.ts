import { Timestamp } from 'firebase/firestore';

export type AuditAction = 
  | 'login' 
  | 'logout' 
  | 'session_closed' 
  | 'ingreso_modulo' 
  | 'salida_modulo' 
  | 'cambio_modulo'
  | 'module_permanence'
  | 'record_permanence'
  | 'view_record'
  | 'create_record'
  | 'update_record'
  | 'delete_record'
  | 'export_document'
  | 'upload_file'
  | 'download_file'
  | 'approve_record'
  | 'finalize_record';

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  email: string;
  role: string;
  action: AuditAction;
  module: string;
  submodule?: string;
  route: string;
  timestamp: Timestamp;
  browser: string;
  operatingSystem: string;
  onlineStatus: boolean;
  sessionId: string;
  durationSeconds?: number;
  durationMinutes?: number;
  recordId?: string;
  recordCode?: string;
}

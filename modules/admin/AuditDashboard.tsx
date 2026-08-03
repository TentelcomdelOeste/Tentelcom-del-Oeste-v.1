import React, { useState, useEffect, useMemo } from 'react';
import { auditService } from '../../services/auditService';
import { AuditLog } from '../../types/audit.types';
import { 
  FiSearch, 
  FiFilter, 
  FiUser, 
  FiActivity, 
  FiGlobe, 
  FiTrash2, 
  FiRefreshCw, 
  FiClock,
  FiUserCheck
} from 'react-icons/fi';
import { ActionButton, IconButton } from '../../design-system';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AuditDashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    setRefreshing(true);
    try {
      const data = await auditService.getLogs();
      setLogs(data);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const modules = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.module) set.add(l.module); });
    return Array.from(set).sort();
  }, [logs]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.action) set.add(l.action); });
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesUser = searchUser === '' || 
        log.userName.toLowerCase().includes(searchUser.toLowerCase()) || 
        log.email.toLowerCase().includes(searchUser.toLowerCase());
      const matchesModule = filterModule === 'all' || log.module === filterModule;
      const matchesAction = filterAction === 'all' || log.action === filterAction;
      return matchesUser && matchesModule && matchesAction;
    });
  }, [logs, searchUser, filterModule, filterAction]);

  const handleCleanup = async () => {
    if (!window.confirm("¿Está seguro de que desea eliminar los registros de auditoría de más de 12 meses?")) return;
    try {
      await auditService.cleanupOldLogs();
      fetchLogs();
    } catch (error) {
      alert("Error al limpiar registros antiguos.");
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'bg-green-100 text-green-700';
      case 'logout': return 'bg-red-100 text-red-700';
      case 'session_closed': return 'bg-orange-100 text-orange-700';
      case 'ingreso_modulo': return 'bg-blue-100 text-blue-700';
      case 'cambio_modulo': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'login': return 'Inicio de Sesión';
      case 'logout': return 'Cierre Manual';
      case 'session_closed': return 'Ventana Cerrada';
      case 'ingreso_modulo': return 'Acceso a Módulo';
      case 'cambio_modulo': return 'Cambio de Módulo';
      default: return action;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando bitácora de auditoría...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-blue-950 uppercase tracking-tighter flex items-center gap-2">
            <FiActivity className="text-blue-600" />
            Auditoría de Accesos
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            Historial detallado de actividad y navegación de usuarios
          </p>
        </div>
        <div className="flex items-center gap-3">
          <IconButton 
            icon={<FiRefreshCw className={refreshing ? 'animate-spin' : ''} />} 
            onClick={fetchLogs}
            disabled={refreshing}
            className="bg-white shadow-sm border border-slate-200"
          />
          <ActionButton 
            variant="outline"
            label="Limpiar Historial Antiguo"
            icon={<FiTrash2 />}
            onClick={handleCleanup}
            className="text-red-600 border-red-100 hover:bg-red-50 text-[11px]"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por usuario o correo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-100 text-xs font-bold text-slate-700"
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <FiGlobe className="text-slate-400" />
          <select 
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 outline-none"
            value={filterModule}
            onChange={e => setFilterModule(e.target.value)}
          >
            <option value="all">Todos los Módulos</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FiFilter className="text-slate-400" />
          <select 
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 outline-none"
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            <option value="all">Todas las Acciones</option>
            {actions.map(a => <option key={a} value={a}>{getActionLabel(a)}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla de Logs */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-500">Fecha / Hora</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-500">Usuario</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-500">Acción</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-500">Módulo</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-500">Sesión / Disp.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredLogs.length > 0 ? (
              filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">
                        {log.timestamp ? format(log.timestamp.toDate(), "dd MMM, yyyy", { locale: es }) : '---'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <FiClock className="text-[9px]" />
                        {log.timestamp ? format(log.timestamp.toDate(), "HH:mm:ss") : '---'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <FiUser className="text-sm" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900 leading-tight">{log.userName}</span>
                        <span className="text-[10px] font-bold text-slate-500">{log.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-blue-950">{log.module || 'Auto'}</span>
                      <span className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]" title={log.route}>
                        {log.route}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                        <FiGlobe className="text-[9px]" />
                        {log.browser} / {log.operatingSystem}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 mt-0.5">
                        <FiUserCheck className="text-[8px]" />
                        ID: {log.sessionId?.substring(0, 8)}...
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center">
                    <FiActivity className="text-4xl text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold">No se encontraron registros que coincidan con los filtros.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
        <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
          <strong>Aviso de Privacidad:</strong> Esta bitácora registra exclusivamente actividad dentro del portal corporativo para fines de seguridad y cumplimiento. 
          Los registros se eliminan automáticamente después de 12 meses.
        </p>
      </div>
    </div>
  );
}

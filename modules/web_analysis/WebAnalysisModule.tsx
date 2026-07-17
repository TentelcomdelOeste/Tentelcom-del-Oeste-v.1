import React, { useState } from 'react';
import { ModulePage } from '@/components/ui/ModulePage';
import { FiTrendingUp, FiShield, FiEye, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import { useWebAnalysis } from './hooks/useWebAnalysis';

const StatCard = ({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-xl`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-500 font-bold uppercase">{title}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const MAPPING: Record<string, string> = {
  'Soluciones Integrales': 'Clic en Soluciones Integrales',
  'Cableado Estructurado': 'Clic en Cableado Estructurado',
  'Fibra Óptica': 'Clic en Fibra Óptica',
  'Certificaciones de Redes': 'Clic en Certificaciones de Redes',
  'WhatsApp': 'Clic en WhatsApp',
  'Teléfono Diego': 'Clic en Teléfono Diego',
  'Teléfono Jonathan': 'Clic en Teléfono Jonathan',
  'correo': 'Clic en correo empresarial',
  'dirección': 'Clic en dirección'
};

export const WebAnalysisModule = ({ currentUser: _currentUser }: { currentUser: any }) => {
  const [activeTab, setActiveTab] = useState<'commercial' | 'security'>('commercial');
  const { events, loading, hasMore, loadMore } = useWebAnalysis();

  const commercialEvents = events.filter(e => ['page_visit', 'service_click', 'contact_click', 'form_submit'].includes(e.eventType));
  const securityEvents = events.filter(e => ['login_attempt', 'login_success', 'login_failed'].includes(e.eventType));

  const sessions = commercialEvents.reduce((acc: any, event: any) => {
    const sid = event.sessionId || 'unknown';
    if (!acc[sid]) acc[sid] = { events: [], timestamp: event.timestamp };
    acc[sid].events.push(event);
    return acc;
  }, {});

  const formatEvent = (e: any) => {
    if (e.eventType === 'page_visit') return `Visitó: ${e.path === '/' ? 'Página Principal' : e.path}`;
    if (e.eventType === 'service_click') return MAPPING[e.service] || `Clic en: ${e.service}`;
    if (e.eventType === 'contact_click') return MAPPING[e.method] || `Contacto: ${e.method}`;
    if (e.eventType === 'form_submit') return `Envió formulario: ${e.form}`;
    return e.eventType;
  };

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage 
        title="Análisis Web" 
        subtitle="Monitoreo comercial de navegación y auditoría de accesos de la plataforma web"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total Eventos" value={events.length} icon={<FiEye />} color="text-blue-600" />
            <StatCard title="Comerciales" value={commercialEvents.length} icon={<FiTrendingUp />} color="text-emerald-600" />
            <StatCard title="Accesos" value={securityEvents.length} icon={<FiShield />} color="text-red-600" />
        </div>

        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setActiveTab('commercial')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${activeTab === 'commercial' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <FiTrendingUp /> Analítica Comercial
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${activeTab === 'security' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <FiShield /> Seguridad de Accesos
          </button>
        </div>

        <div>
          {activeTab === 'commercial' ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-blue-950 mb-4">Historial de Navegación por Sesión</h2>
              <div className="space-y-6">
                {Object.entries(sessions).map(([sid, session]: [string, any]) => (
                    <div key={sid} className="border-t pt-4">
                        <p className="text-xs font-bold text-slate-500 mb-2">Sesión: {sid}</p>
                        <ul className="text-xs space-y-1">
                            {session.events.map((e: any) => (
                                <li key={e.id} className="text-slate-700 flex justify-between">
                                    <span>{formatEvent(e)}</span>
                                    <span className="text-slate-400">{e.timestamp?.toDate().toLocaleTimeString()}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-red-950 mb-4">Intentos de Acceso</h2>
              <div className="overflow-auto">
                  <table className="w-full text-xs text-left">
                      <thead className="text-slate-400 capitalize">
                          <tr>
                              <th className="p-2">Usuario</th>
                              <th className="p-2">Resultado</th>
                              <th className="p-2">Fecha</th>
                          </tr>
                      </thead>
                      <tbody>
                          {securityEvents.map(e => (
                              <tr key={e.id} className="border-t border-slate-100">
                                  <td className="p-2 text-slate-700">{e.email || 'Anónimo'}</td>
                                  <td className={`p-2 font-bold flex items-center gap-1 ${e.eventType === 'login_success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {e.eventType === 'login_success' ? <FiCheckCircle /> : <FiXCircle />}
                                    {e.eventType === 'login_success' ? 'Acceso Exitoso' : 'Acceso Denegado'}
                                  </td>
                                  <td className="p-2 text-slate-400">{e.timestamp?.toDate().toLocaleString()}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
            </div>
          )}
          
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button 
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
              >
                {loading ? <><FiLoader className="animate-spin" /> Cargando...</> : 'Cargar más eventos'}
              </button>
            </div>
          )}
        </div>
      </ModulePage>
    </div>
  );
};

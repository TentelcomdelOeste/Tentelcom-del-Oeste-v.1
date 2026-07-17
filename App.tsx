import React, { useState, useEffect, Suspense, lazy, useContext } from 'react';
import { UserContext } from './contexts/UserContextInstance';
import PublicWebsite from './PublicWebsite';
import { LOGO_BASE64, LOGO14_BASE64 } from './utils/logoBase64';
const loginLogo = LOGO14_BASE64;
const dashboardLogo = LOGO_BASE64;
import { SyncToast } from './components/SyncToast';
import { OnlineStatusIndicator } from './components/OnlineStatusIndicator';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';

const FinanceModule = lazy(() => import('./modules/FinanceModule').then(module => ({ default: module.FinanceModule })));
const QuotesModule = lazy(() => import('./modules/quotes/QuotesModule').then(module => ({ default: module.QuotesModule })));
const JobSchedulingModule = lazy(() => import('./modules/job_scheduling/JobSchedulingModule').then(module => ({ default: module.JobSchedulingModule })));
const OperationalLogView = lazy(() => import('./modules/job_scheduling/OperationalLogView'));
const ExternalProductModule = lazy(() => import('./modules/external_products/ExternalProductModule').then(module => ({ default: module.ExternalProductModule })));
const WebAnalysisModule = lazy(() => import('./modules/web_analysis/WebAnalysisModule').then(module => ({ default: module.WebAnalysisModule })));
const HealthDashboard = lazy(() => import('./modules/admin/HealthDashboard'));
const VehiclesModule = lazy(() => import('./modules/vehicles/VehiclesModule'));

import { User } from './utils/types';
import { can, isAdmin } from './utils/permissions';
import { MODULES_CONFIG } from './utils/permissionsConfig';
import { trackEvent } from './services/analyticsService';
import { AuthGuard } from './auth/AuthGuard';
import { NetworkStatusIndicator } from './components/NetworkStatusIndicator';
import { FiArrowLeft, FiFileText, FiHome, FiBox, FiGlobe, FiMenu, FiLogOut, FiEye, FiEyeOff, FiChevronDown, FiTruck } from "react-icons/fi";
import { GlobalSearch } from './components/GlobalSearch';
import { ActionButton, IconButton } from './design-system';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationCenter } from "./modules/job_scheduling/components/NotificationCenter";
import { usePendingUploadsRecovery } from './modules/job_scheduling/hooks/usePendingUploadsRecovery';
import { auditService } from './services/auditService';
import { useModulePreloader } from './hooks/useModulePreloader';
import { useInitialSync } from './hooks/useInitialSync';
import { useOfflineQueueProcessor } from './hooks/useOfflineQueueProcessor';
import { localDB } from './core/offline/localDB';
import { OfflineStatusBar } from './core/offline/OfflineStatusBar';
import { localDocStore } from './core/offline/localDocStore';
import { syncEngine } from './core/offline/syncEngine';
import { offlineQueueEngine } from './core/offline/offlineQueueEngine';
import { requestNotificationPermission, onMessageListener, subscribeUserToPush } from './services/notificationService';

// ====== MODO SANDBOX (Solo para Phase 2 & 3) ======
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  const sandboxNamespace = {
    offlineQueueEngine,
    localDocStore,
    syncEngine,
    cleanup: () => {
      console.log("Sandbox cleanup");
      delete (window as any).__SANDBOX_OFFLINE_TEST__;
    }
  };
  (window as any).__SANDBOX_OFFLINE_TEST__ = sandboxNamespace;
}
// ==================================================

const WelcomeDashboard = (_props: { currentUser?: unknown }) => (
  <div className="flex flex-col items-center justify-center min-h-full text-center p-6 md:p-8">
    <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full shadow-2xl flex items-center justify-center mb-6 md:mb-8 relative">
      <div className="absolute inset-0 rounded-full bg-blue-50 animate-ping opacity-20"></div>
      <img
        src={dashboardLogo}
        alt="Tentelcom"
        className="relative z-10 w-16 h-auto md:w-24 object-contain block opacity-100"
      />
    </div>
    <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-blue-950 uppercase tracking-tighter mb-4 leading-tight">
      PORTAL DE GESTIÓN CORPORATIVA
    </h1>
    <p className="text-sm md:text-lg text-slate-500 font-bold max-w-2xl mb-10 md:mb-12">
      Control y administración integral de operaciones, inventario y finanzas.
    </p>
  </div>
);

const MODULE_PATHS: Record<string, string> = {
  'home': '/',
  'cotizaciones': '/cotizaciones',
  'pre_analysis': '/evaluacion-proyectos',
  'job_scheduling': '/job-scheduling',
  'employees': '/colaboradores',
  'absences': '/ausencias',
  'payroll_corporate': '/planilla-corporativa',
  'stubs': '/colillas',
  'cashflow': '/movimientos',
  'project_analysis': '/analisis-proyectos',
  'billing': '/facturacion',
  'purchase_orders': '/ordenes-compra',
  'inventory_general': '/inventario-general',
  'inventory_movements': '/movimientos-stock',
  'material_reports': '/solicitudes-materiales',
  'material_report': '/reporte-materiales',
  'external_products': '/productos-externos',
  'product_ingestion': '/ingestion-productos',
  'web_analysis': '/analisis-web',
  'health_dashboard': '/admin/health',
  'vehicles_logs': '/vehicles-logs',
  'vehicles_analysis': '/vehicles-analysis',
  'analisis_costos': '/analisis-costos'
};

const PATH_TO_MODULE: Record<string, string> = Object.entries(MODULE_PATHS).reduce((acc, [mod, path]) => {
  acc[path] = mod;
  return acc;
}, {} as Record<string, string>);

const getModuleLabel = (modId: string): string => {
  const mapping: Record<string, string> = {
    'cotizaciones': 'Cotizaciones',
    'job_scheduling': 'Programación de Trabajos',
    'employees': 'Finanzas / RRHH',
    'absences': 'Finanzas / RRHH',
    'payroll_corporate': 'Finanzas / RRHH',
    'stubs': 'Finanzas / RRHH',
    'cashflow': 'Finanzas / RRHH',
    'project_analysis': 'Finanzas / RRHH',
    'billing': 'Finanzas / RRHH',
    'purchase_orders': 'Finanzas / RRHH',
    'vehicles_logs': 'Bitácora de Vehículos',
    'vehicles_analysis': 'Bitácora de Vehículos',
    'vehicles_analysis_detail': 'Bitácora de Vehículos',
    'analisis_costos': 'Bitácora de Vehículos',
    'inventory_general': 'Inventario',
    'inventory_movements': 'Inventario',
    'material_reports': 'Inventario',
    'material_report': 'Inventario',
    'external_products': 'Productos Externos',
    'health_dashboard': 'Sistema'
  };
  return mapping[modId] || modId;
};

interface SidebarContentProps {
  currentUser: User | null | undefined;
  activeModule: {
    module: string;
    selectedId?: string;
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
  };
  expandedMenus: string[];
  toggleMenu: (menuId: string) => void;
  setActiveModule: (moduleData: string | {
    module: string;
    selectedId?: string;
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
    state?: any;
  }) => void;
  setMobileMenuOpen: (open: boolean) => void;
}

const SidebarContent = ({
  currentUser,
  activeModule,
  expandedMenus,
  toggleMenu,
  setActiveModule,
  setMobileMenuOpen
}: SidebarContentProps) => (
  <div className="px-6 space-y-3 py-6 custom-scrollbar text-left w-full h-full">

    {/* Cotizaciones Group */}
    {(can(currentUser, 'cotizaciones') || can(currentUser, 'pre_analysis') || can(currentUser, 'trabajos')) && (
      <div>
        <ActionButton
          onClick={() => toggleMenu('cotizaciones')}
          className="w-full flex items-center justify-start px-0 py-2 -ml-4 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-all border-none bg-transparent shadow-none min-h-0"
          variant="secondary"
          label={
            <div className="w-full flex items-center justify-start text-left">
              <div className="flex items-center gap-1">
                <FiFileText className="w-5" />
                <span className="text-xs uppercase tracking-wide whitespace-nowrap">Cotizaciones</span>
                <FiChevronDown className={`text-xs transition-transform ml-1 ${expandedMenus.includes('cotizaciones') ? 'rotate-180' : ''}`} />
              </div>
            </div>
          }
        />
        {expandedMenus.includes('cotizaciones') && (
          <div className="pl-0 mt-1 space-y-1">
            {[
              { id: 'cotizaciones', label: "Panel de cotizaciones", perm: 'cotizaciones' },
              { id: 'pre_analysis', label: MODULES_CONFIG.pre_analysis.label, perm: 'pre_analysis' },
            ]
              .filter(item => can(currentUser, item.perm))
              .map(item => (
                <ActionButton
                  key={item.id}
                  onClick={() => { setActiveModule(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-start text-left px-0 py-1.5 -ml-2 rounded-lg text-[11px] font-bold transition-all relative border-none bg-transparent shadow-none min-h-0 ${activeModule.module === item.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  variant="secondary"
                  label={
                    <div className="flex items-center gap-2 min-w-0 md:whitespace-nowrap">
                      <div className="w-1.5 h-1.5 flex-shrink-0">
                        {activeModule.module === item.id && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full block"></span>}
                      </div>
                      <span className="md:truncate text-left leading-tight py-1">{item.label}</span>
                    </div>
                  }
                />
              ))}
          </div>
        )}
      </div>
    )}

    {can(currentUser, 'trabajos') && (
      <div className="mt-2">
        <ActionButton
          onClick={() => { setActiveModule('job_scheduling'); setMobileMenuOpen(false); }}
          className={`w-full flex items-center justify-start px-0 py-2 -ml-4 rounded-xl font-bold transition-all border-none bg-transparent shadow-none min-h-0 ${activeModule.module === 'job_scheduling' ? 'text-blue-600 bg-slate-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          variant="secondary"
          label={
            <div className="w-full flex items-center justify-start text-left">
              <div className="flex items-center gap-1">
                <FiFileText className="w-5" />
                <span className="text-xs uppercase tracking-wide whitespace-nowrap">{MODULES_CONFIG.trabajos.label}</span>
              </div>
            </div>
          }
        />
      </div>
    )}

    {can(currentUser, 'finanzas') && (
      <div>
        <ActionButton
          onClick={() => toggleMenu('finanzas')}
          className="w-full flex items-center justify-start px-0 py-2 -ml-4 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-all border-none bg-transparent shadow-none min-h-0"
          variant="secondary"
          label={
            <div className="w-full flex items-center justify-start text-left">
              <div className="flex items-center gap-1">
                <FiHome className="w-5" />
                <span className="text-xs uppercase tracking-wide whitespace-nowrap">{MODULES_CONFIG.finanzas.label}</span>
                <FiChevronDown className={`text-xs transition-transform ml-1 ${expandedMenus.includes('finanzas') ? 'rotate-180' : ''}`} />
              </div>
            </div>
          }
        />
        {expandedMenus.includes('finanzas') && (
          <div className="pl-0 mt-1 space-y-1">
            {[
              { id: 'employees', label: MODULES_CONFIG.finanzas.submodules.empleados, perm: 'empleados' },
              { id: 'absences', label: MODULES_CONFIG.finanzas.submodules.ausencias, perm: 'ausencias' },
              { id: 'payroll_corporate', label: MODULES_CONFIG.finanzas.submodules.payroll, perm: 'payroll' },
              { id: 'stubs', label: MODULES_CONFIG.finanzas.submodules.comprobantes, perm: 'comprobantes' },
              { id: 'cashflow', label: MODULES_CONFIG.finanzas.submodules.movimientos, perm: 'movimientos' },
              { id: 'project_analysis', label: MODULES_CONFIG.finanzas.submodules.analisis, perm: 'analisis' },
              { id: 'billing', label: MODULES_CONFIG.finanzas.submodules.facturacion, perm: 'facturacion' },
              { id: 'purchase_orders', label: MODULES_CONFIG.finanzas.submodules.ordenes_compra, perm: 'ordenes_compra' },
            ]
              .filter(item => can(currentUser, `finanzas.${item.perm}`))
              .map(item => (
                <ActionButton
                  key={item.id}
                  onClick={() => { setActiveModule(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-start text-left px-0 py-1.5 -ml-2 rounded-lg text-[11px] font-bold transition-all relative border-none bg-transparent shadow-none min-h-0 ${activeModule.module === item.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  variant="secondary"
                  label={
                    <div className="flex items-center gap-2 min-w-0 md:whitespace-nowrap">
                      <div className="w-1.5 h-1.5 flex-shrink-0">
                        {activeModule.module === item.id && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full block"></span>}
                      </div>
                      <span className="md:truncate text-left leading-tight py-1">{item.label}</span>
                    </div>
                  }
                />
              ))}
          </div>
        )}
      </div>
    )}

    {/* Bitacora de Vehiculos Group */}
    {can(currentUser, 'bitacoraVehiculos') && (
      <div>
        <ActionButton
          onClick={() => toggleMenu('bitacoraVehiculos')}
          className="w-full flex items-center justify-start px-0 py-2 -ml-4 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-all border-none bg-transparent shadow-none min-h-0"
          variant="secondary"
          label={
            <div className="w-full flex items-center justify-start text-left">
              <div className="flex items-center gap-1">
                <FiTruck className="w-5" />
                <span className="text-xs uppercase tracking-wide whitespace-nowrap">{MODULES_CONFIG.bitacoraVehiculos.label}</span>
                <FiChevronDown className={`text-xs transition-transform ml-1 ${expandedMenus.includes('bitacoraVehiculos') ? 'rotate-180' : ''}`} />
              </div>
            </div>
          }
        />
        {expandedMenus.includes('bitacoraVehiculos') && (
          <div className="pl-0 mt-1 space-y-1">
            {[
              { id: 'vehicles_logs', label: MODULES_CONFIG.bitacoraVehiculos.submodules.registros, perm: 'registros' },
              { id: 'vehicles_analysis', label: MODULES_CONFIG.bitacoraVehiculos.submodules.analisis, perm: 'analisis' },
            ]
              .filter(item => can(currentUser, `bitacoraVehiculos.${item.perm}`))
              .map(item => (
                <ActionButton
                  key={item.id}
                  onClick={() => { setActiveModule(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-start text-left px-0 py-1.5 -ml-2 rounded-lg text-[11px] font-bold transition-all relative border-none bg-transparent shadow-none min-h-0 ${activeModule.module === item.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  variant="secondary"
                  label={
                    <div className="flex items-center gap-2 min-w-0 md:whitespace-nowrap">
                      <div className="w-1.5 h-1.5 flex-shrink-0">
                        {activeModule.module === item.id && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full block"></span>}
                      </div>
                      <span className="md:truncate text-left leading-tight py-1">{item.label}</span>
                    </div>
                  }
                />
              ))}
          </div>
        )}
      </div>
    )}

    {can(currentUser, 'inventario') && (
      <div>
        <ActionButton
          onClick={() => toggleMenu('inventario')}
          className="w-full flex items-center justify-start px-0 py-2 -ml-4 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-all border-none bg-transparent shadow-none min-h-0"
          variant="secondary"
          label={
            <div className="w-full flex items-center justify-start text-left">
              <div className="flex items-center gap-1">
                <FiBox className="w-5" />
                <span className="text-xs uppercase tracking-wide whitespace-nowrap">{MODULES_CONFIG.inventario.label}</span>
                <FiChevronDown className={`text-xs transition-transform ml-1 ${expandedMenus.includes('inventario') ? 'rotate-180' : ''}`} />
              </div>
            </div>
          }
        />
        {expandedMenus.includes('inventario') && (
          <div className="pl-0 mt-1 space-y-1">
            {[
              { id: 'inventory_general', label: 'Inventario General', perm: 'general' },
              { id: 'inventory_movements', label: 'Movimientos Stock', perm: 'movimientos' },
              { id: 'material_reports', label: 'Solicitudes', perm: 'solicitudes' },
              { id: 'material_report', label: 'Reporte de Materiales', perm: 'reportes' },
            ]
              .filter(item => can(currentUser, `inventario.${item.perm}`))
              .map(item => (
                <ActionButton
                  key={item.id}
                  onClick={() => { setActiveModule(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-start text-left px-0 py-1.5 -ml-2 rounded-lg text-[11px] font-bold transition-all relative border-none bg-transparent shadow-none min-h-0 ${activeModule.module === item.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  variant="secondary"
                  label={
                    <div className="flex items-center gap-2 min-w-0 md:whitespace-nowrap">
                      <div className="w-1.5 h-1.5 flex-shrink-0">
                        {activeModule.module === item.id && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full block"></span>}
                      </div>
                      <span className="md:truncate text-left leading-tight py-1">{item.label}</span>
                    </div>
                  }
                />
              ))}
          </div>
        )}
      </div>
    )}

    {can(currentUser, 'external_products') && (
      <div className="mt-2">
        <ActionButton
          onClick={() => { setActiveModule('external_products'); setMobileMenuOpen(false); }}
          className={`w-full flex items-center justify-start px-0 py-2 -ml-4 rounded-xl font-bold transition-all border-none bg-transparent shadow-none min-h-0 ${activeModule.module === 'external_products' ? 'text-blue-600 bg-slate-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          variant="secondary"
          label={
            <div className="w-full flex items-center justify-start text-left">
              <div className="flex items-center gap-1">
                <FiGlobe className="w-5" />
                <span className="text-xs uppercase tracking-wide whitespace-nowrap">Productos Externos</span>
              </div>
            </div>
          }
        />
      </div>
    )}

    {isAdmin(currentUser?.role) && (
      <div className="mt-2">
        <ActionButton
          onClick={() => { setActiveModule('health_dashboard'); setMobileMenuOpen(false); }}
          className={`w-full flex items-center justify-start px-0 py-2 -ml-4 rounded-xl font-bold transition-all border-none bg-transparent shadow-none min-h-0 ${activeModule.module === 'health_dashboard' ? 'text-blue-600 bg-slate-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          variant="secondary"
          label={
            <div className="w-full flex items-center justify-start text-left">
              <div className="flex items-center gap-1">
                <FiHome className="w-5" />
                <span className="text-xs uppercase tracking-wide whitespace-nowrap">Sistema</span>
              </div>
            </div>
          }
        />
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────
// APP COMPONENT
// ─────────────────────────────────────────────
function App() {
 
  React.useEffect(() => {
    localDB.init();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          if (reg.active?.scriptURL.includes('service-worker.js')) {
            reg.unregister();
          }
        });
      });
    }
  }, []);

  const context = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthLoading = context?.isAuthLoading;
  const isAuthResolving = context?.isAuthResolving;
  const isLoggedIn = context?.isLoggedIn;
  const login = context?.login;
  const loginError = context?.loginError;
  const currentUser = context?.currentUser;
  const logout = context?.logout;
  const authReady = context?.authReady || false;

  // Hooks globales — solo se activan cuando auth está confirmada
  usePendingUploadsRecovery(authReady ? (currentUser || null) : null);
  useModulePreloader(authReady && !!currentUser);
  useInitialSync({
    userId: authReady ? (currentUser?.id || null) : null,
    userName: authReady ? (currentUser?.name || null) : null,
    currentUser: authReady ? (currentUser || null) : null
  });
  useOfflineQueueProcessor(authReady && !!currentUser);

  useEffect(() => {
    syncEngine.setAuthStatus(authReady, authReady ? (currentUser || null) : null);
  }, [authReady, currentUser]);

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      let handle: number;
      if ('requestIdleCallback' in window) {
        handle = (window as any).requestIdleCallback(() => {
          // If permission is already granted, subscribe silently.
          // Otherwise, we could request it, but we respect the "when granted" logic.
          if (Notification.permission === 'granted') {
            subscribeUserToPush(currentUser.id);
          } else if (Notification.permission === 'default') {
            // Only request if the user is active (we use requestIdleCallback for this)
            requestNotificationPermission();
          }
        }, { timeout: 5000 });
      } else {
        handle = window.setTimeout(() => {
          if (Notification.permission === 'granted') {
            subscribeUserToPush(currentUser.id);
          } else {
            requestNotificationPermission();
          }
        }, 100);
      }
      const unsubscribe = onMessageListener((_payload) => {});
      return () => {
        if ('cancelIdleCallback' in window && handle) {
          (window as any).cancelIdleCallback(handle);
        } else if (handle) {
          clearTimeout(handle);
        }
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    const params = new URLSearchParams(location.search);
    const notificationTrabajoId = params.get('trabajoId');
    const notificationComentarioId = params.get('comentarioId');
    const notificationParentCollection = params.get('parentCollection');
    if (notificationTrabajoId) {
      navigate(`/bitacora/${notificationTrabajoId}`, {
        replace: true,
        state: {
          selectedId: notificationTrabajoId,
          parentId: notificationTrabajoId,
          parentCollection: notificationParentCollection || 'trabajos',
          scrollToCommentId: notificationComentarioId
        }
      });
    }
  }, [isLoggedIn, currentUser, location.search, navigate]);

  useEffect(() => {
    const errorHandler = (msg: any, url: any, line: any, col: any, error: any) => {
      console.error("GLOBAL ERROR:", msg, "at", url, ":", line, col, error);
      return false;
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("🔥 [DIAGNOSTIC] UNHANDLED PROMISE REJECTION:", event.reason);
    };
    window.onerror = errorHandler;
    window.addEventListener('unhandledrejection', rejectionHandler);
    return () => {
      window.onerror = null;
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  const [view, setView] = useState<'public' | 'login'>('public');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeModule, setActiveModuleState] = useState<{
    module: string;
    selectedId?: string;
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
    state?: any;
  }>({ module: 'home' });
  const [openedModules, setOpenedModules] = useState<Set<string>>(new Set(['home']));
  const lastModuleRef = React.useRef<string | null>(null);
  const entryTimeRef = React.useRef<number>(Date.now());

  useEffect(() => {
    if (!currentUser || !isLoggedIn) {
      lastModuleRef.current = null;
      return;
    }

    const currentModule = activeModule.module;
    const currentLabel = getModuleLabel(currentModule);
    const lastLabel = lastModuleRef.current ? getModuleLabel(lastModuleRef.current) : null;

    if (currentLabel !== lastLabel) {
      // Calculate duration for previous module if it exists
      if (lastLabel && lastModuleRef.current !== 'home' && lastModuleRef.current !== null) {
        const durationSeconds = Math.floor((Date.now() - entryTimeRef.current) / 1000);
        auditService.logEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          action: 'module_permanence',
          module: lastLabel,
          route: location.pathname,
          durationSeconds
        });
      }

      // Log new entry
      if (currentModule !== 'home') {
        auditService.logEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          action: 'ingreso_modulo',
          module: currentLabel,
          route: location.pathname
        });
      }
      
      lastModuleRef.current = currentModule;
      entryTimeRef.current = Date.now();
    }
  }, [activeModule.module, currentUser, isLoggedIn, location.pathname]);

  useEffect(() => {
    const handleUnload = () => {
      if (currentUser && isLoggedIn) {
        const currentLabel = getModuleLabel(activeModule.module);
        
        // Log final permanence on close
        const durationSeconds = Math.floor((Date.now() - entryTimeRef.current) / 1000);
        if (activeModule.module !== 'home') {
          auditService.logEvent({
            userId: currentUser.id,
            userName: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            action: 'module_permanence',
            module: currentLabel,
            route: location.pathname,
            durationSeconds
          });
        }

        // Audit system closed
        auditService.logEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          action: 'session_closed',
          module: currentLabel,
          route: location.pathname
        });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentUser, isLoggedIn, activeModule.module, location.pathname]);

  useEffect(() => {
    if (activeModule.module) {
      setOpenedModules(prev => {
        if (prev.has(activeModule.module)) return prev;
        const next = new Set(prev);
        next.add(activeModule.module);
        return next;
      });
    }
  }, [activeModule.module]);

  useEffect(() => {
    const path = location.pathname;
    let moduleFromPath = PATH_TO_MODULE[path];
    let routeSelectedId = location.state?.selectedId;

    if (path.startsWith('/analisis-flota/unidad/')) {
      const parts = path.split('/').filter(Boolean);
      routeSelectedId = parts.length > 2 ? parts[2] : undefined;
      if (parts.length > 3 && parts[3] === 'costos') {
        moduleFromPath = 'analisis_costos';
      } else {
        moduleFromPath = 'vehicles_analysis_detail';
      }
    }

    if (path.startsWith('/bitacora/')) {
      moduleFromPath = 'operational_log';
      const parts = path.split('/').filter(Boolean);
      routeSelectedId = parts.length > 1 ? parts[1] : undefined;
    }

    trackEvent('page_visit', { path: path, module: moduleFromPath || 'unknown' });

    const stateKeysMatch = JSON.stringify(activeModule.state) === JSON.stringify(location.state);

    if (moduleFromPath && (
      activeModule.module !== moduleFromPath ||
      activeModule.selectedId !== routeSelectedId ||
      !stateKeysMatch
    )) {
      setActiveModuleState({
        module: moduleFromPath,
        selectedId: routeSelectedId,
        selectedKey: location.state?.selectedKey,
        jobId: location.state?.jobId,
        otCode: location.state?.otCode,
        state: location.state || undefined
      });
    }
  }, [location.pathname, location.state, activeModule.module, activeModule.selectedId, activeModule.state]);

  const setActiveModule = (moduleData: string | {
    module: string;
    selectedId?: string;
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
    state?: any;
  }) => {
    const moduleObj = typeof moduleData === 'string' ? { module: moduleData } : moduleData;
    let path = MODULE_PATHS[moduleObj.module] || `/${moduleObj.module.replace(/_/g, '-')}`;

    if (moduleObj.module === 'vehicles_analysis_detail' && moduleObj.selectedId) {
      path = `/analisis-flota/unidad/${moduleObj.selectedId}`;
    }
    if (moduleObj.module === 'analisis_costos' && moduleObj.selectedId) {
      path = `/analisis-flota/unidad/${moduleObj.selectedId}/costos`;
    }
    if (moduleObj.module === 'operational_log' && moduleObj.selectedId) {
      path = `/bitacora/${moduleObj.selectedId}`;
    }

    React.startTransition(() => {
      navigate(path, {
        state: {
          ...moduleObj.state,
          selectedId: moduleObj.selectedId,
          selectedKey: moduleObj.selectedKey,
          jobId: moduleObj.jobId,
          otCode: moduleObj.otCode
        }
      });
    });
  };

  const clearSelectedId = () => {
    setActiveModuleState(prev => ({
      ...prev,
      selectedId: undefined,
      selectedKey: undefined,
      jobId: undefined,
      otCode: undefined
    }));
  };

  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (isLoggedIn && currentUser && 'Notification' in window && Notification.permission === 'granted') {
      const shown = localStorage.getItem('telecom-battery-tip-shown');
      if (!shown) {
        const timer = setTimeout(() => {
          setSyncMessage("💡 Tip: Para notificaciones instantáneas en Android, ve a Ajustes → Apps → Chrome → Batería → Sin restricciones");
          localStorage.setItem('telecom-battery-tip-shown', 'true');
          setTimeout(() => setSyncMessage(''), 10000);
        }, 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    if (!isLoggedIn) {
      setExpandedMenus([]);
    }
  }, [isLoggedIn]);

  if (!context) {
    return <div>Error: UserContext not found</div>;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    await trackEvent('login_attempt', { email: loginEmail });
    try {
      await login!(loginEmail, loginPassword);
      await trackEvent('login_success', { email: loginEmail });
      setActiveModule('home');
    } catch (error) {
      await trackEvent('login_failed', { email: loginEmail, error: error instanceof Error ? error.message : 'Unknown' });
      console.error("Login failed", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (logout) {
      setLoginEmail('');
      setLoginPassword('');
      setActiveModule('home');
      await logout();
    }
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  // ── FASE 1: Carga inicial del sistema ──
  if (isAuthLoading && !isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse">Iniciando sistema...</p>
      </div>
    );
  }

  // ── FASE 2: Período de gracia — Firebase restaurando sesión desde IndexedDB ──
  if (isAuthResolving && !authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse">Restaurando sesión...</p>
      </div>
    );
  }

  // ── FASE 3: Sin sesión activa — mostrar login ──
  if (!isLoggedIn) {
    if (view === 'public') {
      return <PublicWebsite onEnterPortal={() => setView('login')} />;
    }
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[360px] rounded-[32px] shadow-2xl overflow-hidden relative">
          <IconButton
            icon={<FiArrowLeft className="text-xs" />}
            onClick={() => setView('public')}
            className="absolute top-4 left-4 z-10"
          />
          <div className="bg-blue-900 pt-10 pb-8 px-6 text-center text-white flex flex-col items-center">
            <img src={loginLogo} alt="Logo Corporativo" className="h-10 w-auto mb-3" />
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase mb-1">Tentelcom</h1>
              <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Acceso Corporativo</p>
            </div>
          </div>
          <form onSubmit={handleAuth} className="p-8 space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Correo electrónico</label>
              <input
                type="text"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Usuario o correo electrónico"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 font-bold text-xs text-blue-950 placeholder:text-slate-400 transition-all disabled:bg-slate-100"
                required
                disabled={isLoggingIn}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 font-bold text-xs text-blue-950 placeholder:text-slate-400 transition-all disabled:bg-slate-100"
                  required
                  disabled={isLoggingIn}
                />
                <IconButton
                  icon={showLoginPassword ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                />
              </div>
            </div>
            {loginError && (
              <div className="text-red-600 text-[10px] font-bold text-center bg-red-50 p-3 rounded-2xl border border-red-100 animate-pulse">
                {loginError}
              </div>
            )}
            <ActionButton
              type="submit"
              label={isLoggingIn ? 'Verificando...' : 'Iniciar sesión'}
              disabled={isLoggingIn}
              fullWidth={true}
              className="mt-2"
            />
          </form>
          <div className="text-center px-8 pb-8">
            <p className="text-[9px] text-slate-300 font-bold">© {new Date().getFullYear()} TENTELCOM DEL OESTE S.A.</p>
          </div>
        </div>
      </div>
    );
  }

  const checkAccess = (module: string): boolean => {
    if (module === 'home') return true;
    if (module === 'health_dashboard') return isAdmin(currentUser?.role);
    if (module === 'operational_log') {
      return !!currentUser?.canUseOperationalLog ||
        isAdmin(currentUser?.role) ||
        can(currentUser || null, 'bitacoraVehiculos.registros') ||
        can(currentUser || null, 'trabajos');
    }
    const permissionMapping: Record<string, string> = {
      'cotizaciones': 'cotizaciones',
      'pre_analysis': 'pre_analysis',
      'job_scheduling': 'trabajos',
      'web_analysis': 'web_analysis',
      'external_products': 'external_products',
      'vehicles_logs': 'bitacoraVehiculos.registros',
      'vehicles_analysis': 'bitacoraVehiculos.analisis',
      'vehicles_analysis_detail': 'bitacoraVehiculos.analisis',
      'analisis_costos': 'bitacoraVehiculos.analisis',
      'employees': 'finanzas.empleados',
      'absences': 'finanzas.ausencias',
      'payroll_corporate': 'finanzas.payroll',
      'stubs': 'finanzas.comprobantes',
      'cashflow': 'finanzas.movimientos',
      'project_analysis': 'finanzas.analisis',
      'billing': 'finanzas.facturacion',
      'purchase_orders': 'finanzas.ordenes_compra',
      'inventory_general': 'inventario.general',
      'inventory_movements': 'inventario.movimientos',
      'material_reports': 'inventario.solicitudes',
      'material_report': 'inventario.reportes'
    };
    const perm = permissionMapping[module];
    if (perm) return can(currentUser || null, perm);
    if (import.meta.env.DEV) console.warn('[checkAccess] Módulo no mapeado:', module);
    return false;
  };

  // ── FASE 4: Sesión activa — renderizar app completa ──
  return (
    <AuthGuard>
      <OfflineStatusBar />
      <SyncToast message={syncMessage} />
      <OnlineStatusIndicator />
      <NetworkStatusIndicator />
      <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-blue-950/80 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar móvil */}
        <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-white z-50 transform transition-transform duration-300 md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <div
            className="h-16 bg-blue-900 flex items-center justify-center cursor-pointer shadow-md z-30 flex-none"
            onClick={() => { setActiveModule('home'); setMobileMenuOpen(false); }}
          >
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase">TENTELCOM</h1>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarContent
              currentUser={currentUser}
              activeModule={activeModule}
              expandedMenus={expandedMenus}
              toggleMenu={toggleMenu}
              setActiveModule={setActiveModule}
              setMobileMenuOpen={setMobileMenuOpen}
            />
          </div>
        </aside>

        {/* Sidebar desktop */}
        <aside className="w-64 bg-white border-r border-slate-200 flex-none hidden md:flex flex-col z-20 h-screen">
          <div
            className="h-16 bg-blue-900 flex items-center justify-center cursor-pointer shadow-md z-30 flex-none"
            onClick={() => setActiveModule('home')}
          >
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase">TENTELCOM</h1>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarContent
              currentUser={currentUser}
              activeModule={activeModule}
              expandedMenus={expandedMenus}
              toggleMenu={toggleMenu}
              setActiveModule={setActiveModule}
              setMobileMenuOpen={setMobileMenuOpen}
            />
          </div>
        </aside>

        {/* Contenido principal */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <header className="bg-blue-900 text-white h-16 grid grid-cols-[auto_1fr_auto] items-center px-4 md:px-5 shadow-md z-30 flex-none sticky top-0">
            <div className="flex items-center min-w-[40px]">
              <div className="md:hidden">
                <IconButton
                  icon={<FiMenu />}
                  onClick={() => setMobileMenuOpen(true)}
                  className="text-white text-xl"
                />
              </div>
            </div>
            <div className="flex justify-start pl-5 px-2">
              <div className="hidden md:flex w-full max-w-[360px]">
                {currentUser && <GlobalSearch currentUser={currentUser} setActiveModule={setActiveModule} />}
              </div>
            </div>
            <div className="flex items-center gap-[6px] md:gap-[10px] justify-end min-w-0 md:min-w-[220px]">
              {currentUser && <SyncStatusIndicator />}
              {currentUser && <NotificationCenter setActiveModule={setActiveModule} />}
              <span className="hidden sm:inline-block text-[11px] text-slate-300 font-bold whitespace-nowrap truncate text-right max-w-[100px] md:max-w-[200px]">
                {currentUser?.email?.split('@')[0]}
              </span>
              <IconButton
                icon={<FiLogOut className="text-xs md:text-sm" />}
                onClick={handleLogout}
                className="w-8 h-8 rounded-lg bg-blue-800 flex items-center justify-center hover:bg-blue-700 transition-all text-blue-200 hover:text-white flex-shrink-0"
                title="Cerrar Sesión"
              />
            </div>
          </header>

          {/* ── MÓDULOS: solo se montan cuando authReady=true ── */}
          <main className="flex-1 overflow-y-auto relative bg-slate-50 px-2 py-6 md:px-5 custom-scrollbar">
            {!authReady ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-slate-500 font-bold animate-pulse ml-3">Cargando módulos...</p>
              </div>
            ) : (
              <Suspense fallback={
                <div className="absolute inset-x-0 top-0 h-1 bg-blue-600/20 overflow-hidden z-50">
                  <div className="h-full bg-blue-600 animate-progress w-full"></div>
                </div>
              }>
                {activeModule.module === 'home' && (
                  <WelcomeDashboard currentUser={currentUser} />
                )}

                {activeModule.module === 'cotizaciones' && (
                  checkAccess('cotizaciones')
                    ? <QuotesModule currentUser={currentUser!} selectedId={activeModule.selectedId} selectedKey={activeModule.selectedKey} onClearSelectedId={clearSelectedId} />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'job_scheduling' && (
                  checkAccess('job_scheduling')
                    ? <JobSchedulingModule onSetActiveModule={setActiveModule} currentUser={currentUser} />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'external_products' && (
                  checkAccess('external_products')
                    ? <ExternalProductModule />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'web_analysis' && (
                  checkAccess('web_analysis')
                    ? <WebAnalysisModule currentUser={currentUser!} />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'health_dashboard' && (
                  checkAccess('health_dashboard')
                    ? <HealthDashboard />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'vehicles_logs' && (
                  checkAccess('vehicles_logs')
                    ? <VehiclesModule currentUser={currentUser!} activeView="registros" selectedId={activeModule.selectedId} onSetActiveModule={setActiveModule} />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'vehicles_analysis' && (
                  checkAccess('vehicles_analysis')
                    ? <VehiclesModule currentUser={currentUser!} activeView="analisis" onSetActiveModule={setActiveModule} />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'vehicles_analysis_detail' && (
                  checkAccess('vehicles_analysis_detail')
                    ? <VehiclesModule currentUser={currentUser!} activeView="analisis_detalle" selectedId={activeModule.selectedId} onSetActiveModule={setActiveModule} />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'analisis_costos' && (
                  checkAccess('analisis_costos')
                    ? <VehiclesModule currentUser={currentUser!} activeView="analisis_costos" selectedId={activeModule.selectedId} onSetActiveModule={setActiveModule} />
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

                {activeModule.module === 'operational_log' && (
                  <div className="fixed inset-0 z-50 bg-white overflow-hidden">
                    {checkAccess('operational_log')
                      ? (
                        <OperationalLogView
                          trabajoId={activeModule.selectedId!}
                          parentId={activeModule.state?.parentId || activeModule.selectedId}
                          parentCollection={activeModule.state?.parentCollection || "trabajos"}
                          onBack={() => setActiveModule('job_scheduling')}
                          onSetActiveModule={setActiveModule} // Added for navigation
                          currentUser={currentUser}
                        />
                      )
                      : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                    }
                  </div>
                )}

                {!['home', 'health_dashboard', 'operational_log', 'cotizaciones', 'job_scheduling', 'external_products', 'web_analysis', 'vehicles_logs', 'vehicles_analysis', 'vehicles_analysis_detail', 'analisis_costos'].includes(activeModule.module) && (
                  checkAccess(activeModule.module)
                    ? (
                      <FinanceModule
                        currentUser={currentUser!}
                        activeView={activeModule.module}
                        selectedId={activeModule.selectedId}
                        selectedKey={activeModule.selectedKey}
                        jobId={activeModule.jobId}
                        otCode={activeModule.otCode}
                        onClearSelectedId={clearSelectedId}
                        onSetActiveModule={setActiveModule}
                      />
                    )
                    : <div className="flex h-full items-center justify-center"><p className="text-slate-400 font-bold">Acceso Restringido</p></div>
                )}

              </Suspense>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

export default App;
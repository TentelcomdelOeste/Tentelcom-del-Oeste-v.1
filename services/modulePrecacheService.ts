// services/modulePrecacheService.ts

export const precacheModules = async (): Promise<void> => {
  
  const modules = [
    () => import('../modules/FinanceModule'),
    () => import('../modules/quotes/QuotesModule'),
    () => import('../modules/job_scheduling/JobSchedulingModule'),
    () => import('../modules/job_scheduling/OperationalLogView'),
    () => import('../modules/external_products/ExternalProductModule'),
    () => import('../modules/web_analysis/WebAnalysisModule'),
    () => import('../modules/admin/HealthDashboard'),
    () => import('../modules/vehicles/VehiclesModule'),
  ];
  
  for (const moduleLoader of modules) {
    try {
      await moduleLoader();
    } catch (err) {
      console.error(`[ModulePrecache] Error fetching module:`, err);
    }
  }
};

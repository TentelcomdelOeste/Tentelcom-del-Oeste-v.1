export * from './types';
export * from './SearchRegistry';
export * from './SearchIndex';
export * from './GlobalSearchEngine';
export * from './plugins';

import { globalSearchEngine } from './GlobalSearchEngine';
import { ClientSearchPlugin } from './plugins/ClientSearchPlugin';
import { InventorySearchPlugin } from './plugins/InventorySearchPlugin';
import { QuoteSearchPlugin } from './plugins/QuoteSearchPlugin';
import { JobSearchPlugin } from './plugins/JobSearchPlugin';
import { VehicleLogSearchPlugin } from './plugins/VehicleLogSearchPlugin';
import { CashflowSearchPlugin } from './plugins/CashflowSearchPlugin';
import { MaterialRequestSearchPlugin } from './plugins/MaterialRequestSearchPlugin';
import { EmployeeSearchPlugin } from './plugins/EmployeeSearchPlugin';
import { CatalogSearchPlugin } from './plugins/CatalogSearchPlugin';
import { DispatchSearchPlugin } from './plugins/DispatchSearchPlugin';

// Instantiate plugins
export const clientSearchPlugin = new ClientSearchPlugin();
export const inventorySearchPlugin = new InventorySearchPlugin();
export const quoteSearchPlugin = new QuoteSearchPlugin();
export const jobSearchPlugin = new JobSearchPlugin();
export const vehicleLogSearchPlugin = new VehicleLogSearchPlugin();
export const cashflowSearchPlugin = new CashflowSearchPlugin();
export const materialRequestSearchPlugin = new MaterialRequestSearchPlugin();
export const employeeSearchPlugin = new EmployeeSearchPlugin();
export const catalogSearchPlugin = new CatalogSearchPlugin();
export const dispatchSearchPlugin = new DispatchSearchPlugin();

// Register plugins with global search engine
globalSearchEngine.registerPlugin(clientSearchPlugin);
globalSearchEngine.registerPlugin(inventorySearchPlugin);
globalSearchEngine.registerPlugin(quoteSearchPlugin);
globalSearchEngine.registerPlugin(jobSearchPlugin);
globalSearchEngine.registerPlugin(vehicleLogSearchPlugin);
globalSearchEngine.registerPlugin(cashflowSearchPlugin);
globalSearchEngine.registerPlugin(materialRequestSearchPlugin);
globalSearchEngine.registerPlugin(employeeSearchPlugin);
globalSearchEngine.registerPlugin(catalogSearchPlugin);
globalSearchEngine.registerPlugin(dispatchSearchPlugin);

import { initSearchDiagnostics } from './diagnostics/SearchDiagnosticsConsole';
initSearchDiagnostics();

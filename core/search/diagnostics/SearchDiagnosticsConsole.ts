import { globalSearchEngine } from '../GlobalSearchEngine';
import { runSearchTestSuite } from './SearchTestSuite';
import { runSearchComparator } from './SearchComparator';

export const initSearchDiagnostics = () => {
  if (typeof window !== 'undefined') {
    (window as any).SearchDiagnostics = {
      enableDebug: () => {
        globalSearchEngine.debugMode = true;
        console.log("GlobalSearchEngine DEBUG mode enabled.");
      },
      disableDebug: () => {
        globalSearchEngine.debugMode = false;
        console.log("GlobalSearchEngine DEBUG mode disabled.");
      },
      getDiagnostics: () => {
        const diag = globalSearchEngine.getDiagnostics();
        console.table(diag);
        return diag;
      },
      runTestSuite: runSearchTestSuite,
      runComparator: runSearchComparator
    };
    console.log("[SearchDiagnostics] Injecting window.SearchDiagnostics utilities.");
  }
};

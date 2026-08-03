import { SearchRegistry } from './SearchRegistry';
import { SearchIndex } from './SearchIndex';
import { SearchableItem, ISearchPlugin, SearchEngineDiagnostics, ISearchPersistence } from './types';

export class GlobalSearchEngine {
  private registry: SearchRegistry;
  private index: SearchIndex;
  private persistence?: ISearchPersistence;
  private status: SearchEngineDiagnostics['status'] = 'valid';
  private lastRebuildTimeMs: number = 0;
  private searchTimes: number[] = [];
  private engineErrors: string[] = [];
  private expectedIndexVersion: string = 'v1.0.0';
  public debugMode: boolean = false;

  constructor(
    registry: SearchRegistry,
    index: SearchIndex,
    persistence?: ISearchPersistence
  ) {
    this.registry = registry;
    this.index = index;
    this.persistence = persistence;
    this.checkVersionCompatibility();
  }

  private checkVersionCompatibility() {
    if (this.index.version !== this.expectedIndexVersion) {
      this.status = 'outdated';
      this.engineErrors.push(`Index version mismatch. Expected ${this.expectedIndexVersion}, got ${this.index.version}. Rebuild required.`);
    }
  }

  // --- Plugin Management ---
  registerPlugin(plugin: ISearchPlugin): void {
    this.registry.register(plugin);
  }

  // --- Index Management ---
  async upsertDocument(item: SearchableItem): Promise<void> {
    if (this.status === 'outdated' || this.status === 'corrupt') {
      this.engineErrors.push(`Cannot upsert document: Index status is ${this.status}`);
      return;
    }
    this.index.upsertItem(item);
    if (this.persistence) {
      // Intentionally decoupled, ready for persistence layer
      // await this.persistence.saveIndex(this.index.serialize());
    }
  }

  async removeDocument(itemId: string): Promise<void> {
    this.index.removeItem(itemId);
    if (this.persistence) {
      // await this.persistence.saveIndex(this.index.serialize());
    }
  }

  // --- Search ---
  async search(query: string, user: any): Promise<SearchableItem[]> {
    if (this.status !== 'valid') {
      if (this.debugMode) console.warn(`[GlobalSearchEngine DEBUG] Search attempted while index status is ${this.status}`);
      return [];
    }
    const startTime = performance.now();
    try {
      const allPlugins = this.registry.getAllPlugins();
      const allowedModules = allPlugins
        .filter(plugin => plugin.canAccess(user))
        .map(plugin => plugin.moduleId);
        
      const discardedModules = allPlugins
        .filter(plugin => !plugin.canAccess(user))
        .map(plugin => plugin.moduleId);

      const results = this.index.search(query, allowedModules);
            
      const endTime = performance.now();
      const timeMs = endTime - startTime;
      this.recordSearchTime(timeMs);
      
      if (this.debugMode) {
        console.log(`[GlobalSearchEngine DEBUG] Query: "${query}"`);
        console.log(`[GlobalSearchEngine DEBUG] Execution time: ${timeMs.toFixed(2)}ms`);
        console.log(`[GlobalSearchEngine DEBUG] Result count: ${results.length}`);
        console.log(`[GlobalSearchEngine DEBUG] Modules queried: ${allowedModules.join(', ')}`);
        console.log(`[GlobalSearchEngine DEBUG] Modules discarded by permissions: ${discardedModules.join(', ')}`);
        
        // Count how many from each module
        const moduleCounts: Record<string, number> = {};
        results.forEach(r => {
          moduleCounts[r.moduleId] = (moduleCounts[r.moduleId] || 0) + 1;
        });
        console.log(`[GlobalSearchEngine DEBUG] Plugins that responded: ${Object.keys(moduleCounts).map(m => `${m} (${moduleCounts[m]})`).join(', ')}`);
        
        if (results.length > 0) {
          console.log(`[GlobalSearchEngine DEBUG] Top score: ${results[0].score?.toFixed(4)}`);
        }
      }

      return results;
    } catch (error: any) {
      if (this.debugMode) console.error(`[GlobalSearchEngine DEBUG] Internal error: `, error);
      this.engineErrors.push(`Search error: ${error.message}`);
      return [];
    }
  }

  // --- Diagnostics ---
  getDiagnostics(): SearchEngineDiagnostics {
    const plugins = this.registry.getAllPlugins();
    
    return {
      indexVersion: this.index.version,
      status: this.status,
      totalItems: this.index.getTotalItems(),
      registeredModules: plugins.length,
      loadedPlugins: plugins.map(p => p.moduleId),
      failedPlugins: this.registry.getFailedPlugins(),
      averageSearchTimeMs: this.getAverageSearchTime(),
      lastRebuildTimeMs: this.lastRebuildTimeMs,
      errors: [...this.engineErrors]
    };
  }

  private recordSearchTime(timeMs: number): void {
    this.searchTimes.push(timeMs);
    if (this.searchTimes.length > 100) {
      this.searchTimes.shift(); // Keep only the last 100 searches
    }
  }

  private getAverageSearchTime(): number {
    if (this.searchTimes.length === 0) return 0;
    const sum = this.searchTimes.reduce((a, b) => a + b, 0);
    return sum / this.searchTimes.length;
  }
  
  // Future: Rebuild index mechanism
  async rebuildIndex(): Promise<void> {
    this.status = 'rebuilding';
    const start = performance.now();
    
    this.index.clearAll();
    
    // In future phases, this will iterate through registered plugins
    // and sync their data into the index.
    
    this.lastRebuildTimeMs = performance.now() - start;
    this.status = 'valid';
    this.engineErrors = []; // Clear errors on successful rebuild
  }
}

// Singleton instance for the application
const defaultRegistry = new SearchRegistry();
const defaultIndex = new SearchIndex();
export const globalSearchEngine = new GlobalSearchEngine(defaultRegistry, defaultIndex);

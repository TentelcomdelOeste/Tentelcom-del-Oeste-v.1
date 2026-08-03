export interface SearchableItem {
  id: string; // Unique identifier across the entire system (e.g., modulePrefix_docId)
  moduleId: string; // ID of the plugin/module it belongs to
  title: string; // Primary display field
  subtitle?: string; // Secondary display field
  content: string; // All searchable text concatenated (universal search)
  score?: number; // Relevance score (computed at search time)
  metadata?: Record<string, any>; // Extra data for navigation and UI
  affinityTags: string[]; // RBAC optimization tags
  updatedAt: number; // Timestamp for incremental updates
}

export interface SmartNavigationContext {
  module: string;
  selectedId: string;
  selectedKey?: string;
  view?: string;
  tab?: string;
}

export interface ISearchPlugin {
  moduleId: string;
  name: string;
  version: string;
  
  // Defines if a user has access to this module's results
  canAccess(user: any): boolean;
  
  // Defines how to navigate to a specific item
  getNavigationContext(item: SearchableItem): SmartNavigationContext;
  
  // Future: method to trigger index building/syncing
  syncIndex?(): Promise<void>; 
}

export interface ISearchPersistence {
  saveIndex(indexData: any): Promise<void>;
  loadIndex(): Promise<any>;
  clearIndex(): Promise<void>;
}

export interface SearchEngineDiagnostics {
  indexVersion: string;
  status: 'valid' | 'outdated' | 'rebuilding' | 'corrupt';
  totalItems: number;
  registeredModules: number;
  loadedPlugins: string[];
  failedPlugins: string[];
  averageSearchTimeMs: number;
  lastRebuildTimeMs: number;
  errors: string[];
}

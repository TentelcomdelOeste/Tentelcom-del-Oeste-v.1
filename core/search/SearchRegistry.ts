import { ISearchPlugin } from './types';

export class SearchRegistry {
  private plugins: Map<string, ISearchPlugin> = new Map();
  private failedPlugins: string[] = [];

  register(plugin: ISearchPlugin): void {
    try {
      if (this.plugins.has(plugin.moduleId)) {
        console.warn(`[SearchRegistry] Plugin ${plugin.moduleId} is already registered. Overwriting.`);
      }
      this.plugins.set(plugin.moduleId, plugin);
    } catch (error) {
      console.error(`[SearchRegistry] Error registering plugin ${plugin.moduleId}:`, error);
      this.failedPlugins.push(plugin.moduleId);
    }
  }

  unregister(moduleId: string): void {
    this.plugins.delete(moduleId);
  }

  getPlugin(moduleId: string): ISearchPlugin | undefined {
    return this.plugins.get(moduleId);
  }

  getAllPlugins(): ISearchPlugin[] {
    return Array.from(this.plugins.values());
  }

  getFailedPlugins(): string[] {
    return [...this.failedPlugins];
  }
}

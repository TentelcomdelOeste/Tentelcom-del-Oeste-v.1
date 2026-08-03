const fs = require('fs');
const file = '/app/applet/core/search/GlobalSearchEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /private expectedIndexVersion: string = 'v1.0.0';/,
  `private expectedIndexVersion: string = 'v1.0.0';\n  public debugMode: boolean = false;`
);

const searchMethod = `
  async search(query: string, user: any): Promise<SearchableItem[]> {
    if (this.status !== 'valid') {
      if (this.debugMode) console.warn(\`[GlobalSearchEngine DEBUG] Search attempted while index status is \${this.status}\`);
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
        console.log(\`[GlobalSearchEngine DEBUG] Query: "\${query}"\`);
        console.log(\`[GlobalSearchEngine DEBUG] Execution time: \${timeMs.toFixed(2)}ms\`);
        console.log(\`[GlobalSearchEngine DEBUG] Result count: \${results.length}\`);
        console.log(\`[GlobalSearchEngine DEBUG] Modules queried: \${allowedModules.join(', ')}\`);
        console.log(\`[GlobalSearchEngine DEBUG] Modules discarded by permissions: \${discardedModules.join(', ')}\`);
        
        // Count how many from each module
        const moduleCounts: Record<string, number> = {};
        results.forEach(r => {
          moduleCounts[r.moduleId] = (moduleCounts[r.moduleId] || 0) + 1;
        });
        console.log(\`[GlobalSearchEngine DEBUG] Plugins that responded: \${Object.keys(moduleCounts).map(m => \`\${m} (\${moduleCounts[m]})\`).join(', ')}\`);
        
        if (results.length > 0) {
          console.log(\`[GlobalSearchEngine DEBUG] Top score: \${results[0].score?.toFixed(4)}\`);
        }
      }

      return results;
    } catch (error: any) {
      if (this.debugMode) console.error(\`[GlobalSearchEngine DEBUG] Internal error: \`, error);
      this.engineErrors.push(\`Search error: \${error.message}\`);
      return [];
    }
  }
`;

content = content.replace(/async search\(query: string, user: any\): Promise<SearchableItem\[\]> {[\s\S]*?return results;\n    } catch \(error: any\) {[\s\S]*?return \[\];\n    }\n  }/, searchMethod.trim());

fs.writeFileSync(file, content);

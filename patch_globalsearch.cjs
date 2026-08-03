const fs = require('fs');
const file = '/app/applet/components/GlobalSearch.tsx';
let content = fs.readFileSync(file, 'utf8');

const importStatement = `import { globalSearchEngine } from '../core/search';\n`;
if (!content.includes('globalSearchEngine')) {
  content = content.replace(/(import .* from '\.\.\/utils\/types';)/, `$1\n${importStatement}`);
}

const newSearchLogic = `
  useEffect(() => {
    if (!currentUser) return;
    
    if (debouncedTerm.length < 2) {
      setResults([]);
      return;
    }

    let isMounted = true;
    
    globalSearchEngine.search(debouncedTerm, currentUser).then(engineResults => {
      if (!isMounted) return;
      
      const mappedResults: SearchResult[] = engineResults.map(res => {
        let type: SearchResult['type'] = 'quote'; // fallback
        if (res.moduleId === 'cotizaciones') type = 'quote';
        else if (res.moduleId === 'clientes') type = 'client';
        else if (res.moduleId === 'inventario') type = 'inventory';
        else if (res.moduleId === 'flujo_caja') type = 'cashflow';
        else if (res.moduleId === 'solicitudes_material') type = 'request';
        else if (res.moduleId === 'vehiculos' || res.moduleId === 'programacion_trabajos') {
            type = 'client'; // Reutilizamos icono de cliente por ahora para estos modulos nuevos
        }
        
        return {
          id: res.id,
          title: res.title,
          subtitle: res.subtitle,
          type: type,
          module: res.moduleId,
          key: 'id',
          originalRes: res // Guardamos el res original para el onClick
        };
      });
      
      setResults(mappedResults);
    }).catch(err => {
      console.error("[GlobalSearch] Search failed:", err);
    });

    return () => {
      isMounted = false;
    };
  }, [debouncedTerm, currentUser]);
`;

content = content.replace(
  /useEffect\(\(\) => {\n    if \(\!currentUser\) return;[\s\S]*?setResults\(newResults\);\n    } catch \(error\) {\n      console\.error\("\[GlobalSearch\] Error global:", error\);\n    }\n  }, \[debouncedTerm, currentUser, quotes, inventory, clients, cashflowAll, cashflowEntries, requests\]\);/,
  newSearchLogic.trim()
);


const newOnClickLogic = `
  const handleSelect = (result: SearchResult) => {
    if ((result as any).originalRes) {
       // Buscar el plugin correspondiente
       const plugin = globalSearchEngine['registry'].getPlugin((result as any).originalRes.moduleId);
       if (plugin) {
           const nav = plugin.getNavigationContext((result as any).originalRes);
           setActiveModule(nav);
       } else {
           setActiveModule({ module: result.module, selectedId: result.id });
       }
    } else {
       setActiveModule({ module: result.module, selectedId: result.id });
    }
    setIsOpen(false);
    setSearchTerm('');
  };
`;

content = content.replace(
  /const handleSelect = \(result: SearchResult\) => {\n    setActiveModule\({ module: result\.module, selectedId: result\.id }\);\n    setIsOpen\(false\);\n    setSearchTerm\(''\);\n  };/,
  newOnClickLogic.trim()
);

fs.writeFileSync(file, content);

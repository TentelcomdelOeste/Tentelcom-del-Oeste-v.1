const fs = require('fs');
const file = '/app/applet/components/GlobalSearch.tsx';
let content = fs.readFileSync(file, 'utf8');

const newOnClickLogic = `
  const handleSelect = (result: SearchResult) => {
    if ((result as any).originalRes) {
       // Buscar el plugin correspondiente
       const plugin = globalSearchEngine['registry'].getPlugin((result as any).originalRes.moduleId);
       if (plugin) {
           const nav = plugin.getNavigationContext((result as any).originalRes);
           setActiveModule(nav);
       } else {
           setActiveModule({ module: result.module, selectedId: result.id, selectedKey: result.key });
       }
    } else {
       setActiveModule({ module: result.module, selectedId: result.id, selectedKey: result.key });
    }
    setIsOpen(false);
    setSearchTerm('');
  };
`;

content = content.replace(
  /const handleSelect = \(result: SearchResult\) => {\n    setActiveModule\({\n      module: result\.module,\n      selectedId: result\.id,\n      selectedKey: result\.key\n    }\);\n    setSearchTerm\(''\);\n    setIsOpen\(false\);\n  };/,
  newOnClickLogic.trim()
);

fs.writeFileSync(file, content);

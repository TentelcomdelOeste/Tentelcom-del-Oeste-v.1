const fs = require('fs');
let code = fs.readFileSync('/app/applet/App.tsx', 'utf8');

// Insert imports
if (!code.includes('import { localDB } from')) {
    code = code.replace("import { useOfflineQueueProcessor } from './hooks/useOfflineQueueProcessor';", 
    "import { useOfflineQueueProcessor } from './hooks/useOfflineQueueProcessor';\nimport { localDB } from './core/offline/localDB';\nimport { OfflineStatusBar } from './core/offline/OfflineStatusBar';");
}

// Insert initialization inside useEffect
if (!code.includes('localDB.init();')) {
    code = code.replace("if ('serviceWorker' in navigator) {", "localDB.init();\n    if ('serviceWorker' in navigator) {");
}

// Insert OfflineStatusBar below SyncToast
if (!code.includes('<OfflineStatusBar />')) {
    code = code.replace("<SyncToast />", "<OfflineStatusBar />\n      <SyncToast />");
}

fs.writeFileSync('/app/applet/App.tsx', code, 'utf8');

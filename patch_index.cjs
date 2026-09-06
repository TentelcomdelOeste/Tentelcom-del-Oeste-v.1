const fs = require('fs');
const file = 'index.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "(window as any).__LAST_ERROR__ = {\n      message: (event.reason as any)?.message || JSON.stringify(event.reason),\n      stack: (event.reason as any)?.stack || null\n    };",
  "let message = (event.reason as any)?.message;\n    if (!message) {\n      try {\n        message = JSON.stringify(event.reason);\n      } catch (e) {\n        message = String(event.reason);\n      }\n    }\n    (window as any).__LAST_ERROR__ = {\n      message: message,\n      stack: (event.reason as any)?.stack || null\n    };"
);

fs.writeFileSync(file, data);

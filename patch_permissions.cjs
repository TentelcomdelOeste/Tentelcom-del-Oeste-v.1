const fs = require('fs');
const file = 'utils/permissionsConfig.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "gestion_proyectos: {\n    label: \"Gestión de Proyectos\",\n    submodules: {\n      crear: \"Crear proyectos\",\n      administrar: \"Ver expediente / administrar proyectos\"\n    }\n  },",
  "gestion_proyectos: {\n    label: \"Gestión de Proyectos\",\n    submodules: {\n      crear: \"Crear proyectos\",\n      editar: \"Editar proyectos\",\n      ver_expediente: \"Ver expediente 360°\",\n      eliminar: \"Eliminar proyectos\"\n    }\n  },"
);

fs.writeFileSync(file, data);

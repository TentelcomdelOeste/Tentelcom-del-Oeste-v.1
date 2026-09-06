const fs = require('fs');
const file = 'firestore.rules';
let data = fs.readFileSync(file, 'utf8');

if (!data.includes("match /projects/{id}")) {
  data = data.replace(
    "// FINANZAS",
    "// PROYECTOS\n    match /projects/{id} {\n      allow read: if isAuthenticated();\n      allow create: if hasNestedPermission(\"gestion_proyectos\", \"crear\") || isAdmin();\n      allow update: if hasNestedPermission(\"gestion_proyectos\", \"editar\") || isAdmin();\n      allow delete: if hasNestedPermission(\"gestion_proyectos\", \"eliminar\") || isAdmin();\n    }\n\n    // FINANZAS"
  );
  fs.writeFileSync(file, data);
}

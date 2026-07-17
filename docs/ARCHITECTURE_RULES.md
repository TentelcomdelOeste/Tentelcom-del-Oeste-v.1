# ARCHITECTURE RULES — Tentelcom System

Este documento define las reglas inmutables que gobiernan el crecimiento del sistema.

Su objetivo es mantener:

- estabilidad estructural  
- coherencia visual  
- predictibilidad  
- bajo riesgo de regresión  

---

# PRINCIPIO FUNDAMENTAL

> El sistema debe crecer por EXTENSIÓN, nunca por reinvención.

Si algo funciona → se respeta.

---

# REGLA #1 — NO DUPLICIDAD (MANDATORIA)

Está TERMINANTEMENTE prohibido:

❌ crear versiones paralelas de un módulo  
❌ copiar archivos para modificarlos  
❌ mantener archivos “legacy” activos  
❌ duplicar hooks  
❌ duplicar helpers  

---

## Regla de Oro:

> Debe existir una sola fuente de verdad.

Si aparece duplicidad:

👉 se analiza  
👉 se decide cuál vive  
👉 la otra se elimina  

Nunca conviven ambas.

---

# REGLA #2 — ARQUITECTURA POR CAPAS

El sistema se divide en capas claras:

### CORE
Infraestructura crítica.

Ejemplos:
- Firebase  
- routing  
- App.tsx  
- clientes DB  
- providers  

⚠️ Zona de máxima protección.

Cambios solo con riesgo evaluado.

---

### DOMAIN (MÓDULOS)
Representan procesos del negocio.

Ejemplos:

- Finanzas  
- Inventario  
- Cotizaciones  
- Órdenes de compra  
- Facturación  
- RRHH  

Cada módulo debe ser:

✅ autocontenido  
✅ predecible  
✅ sin dependencias ocultas  

---

### SHARED (HELPERS)
Funciones reutilizables.

Ejemplos:

- formatCurrency  
- pdf engines  
- validators  
- export helpers  

Regla clave:

> Si se usa en 3 lugares → debe centralizarse.

---

### UI SYSTEM
Patrones visuales reutilizables.

Ejemplos:

- ModuleHeader  
- ModuleToolbar  
- Tables  
- Filters  
- Search bars  

⚠️ PROHIBIDO crear variantes innecesarias.

Se reutiliza SIEMPRE el patrón existente.

---

# REGLA #3 — PRINCIPIO DE CAMBIO QUIRÚRGICO

Antes de modificar algo:

Preguntar:

> ¿Cuál es el cambio MÁS pequeño que resuelve esto?

Ese es el correcto.

Nunca:

❌ reescribir módulos  
❌ hacer refactors masivos  
❌ cambiar estructuras estables  

---

# REGLA #4 — PROHIBIDO INVENTAR ARQUITECTURA

La IA o cualquier desarrollador NO debe:

❌ crear nuevas estructuras de carpetas  
❌ mover módulos sin análisis  
❌ cambiar patrones establecidos  
❌ introducir frameworks internos  

Primero se evalúa.

Luego se decide.

Nunca se improvisa.

---

# REGLA #5 — CONSISTENCIA VISUAL OBLIGATORIA

Todos los módulos deben respetar:

### Orden estructural:

ModuleHeader  
ModuleToolbar  
ModuleContent  

El header NO debe contener:

- botones  
- filtros  
- toggles  

Solo:

✔ título  
✔ subtítulo  
✔ divider  

---

# REGLA #6 — CENTRALIZACIÓN PROGRESIVA

Cuando se detecte lógica repetida:

NO se deja duplicada.

Se migra hacia helpers compartidos.

Ejemplos prioritarios:

- formato de moneda  
- motores de PDF  
- validadores  
- exportaciones  

---

# REGLA #7 — SISTEMA FINANCIERO = ZONA CRÍTICA

Todo lo relacionado con dinero es:

🔥 altamente sensible.

Incluye:

- facturación  
- órdenes de compra  
- movimientos  
- análisis financiero  

Regla:

> Nunca modificar sin analizar impacto.

---

# REGLA #8 — MENTALIDAD DEL SISTEMA

Este NO es un proyecto experimental.

Debe evolucionar como un sistema empresarial.

Prioridades:

Estabilidad > velocidad  
Seguridad > creatividad  
Claridad > automatización  

---

# REGLA #9 — ANTES DE ESCALAR

Antes de introducir grandes mejoras:

Verificar siempre:

- ¿Rompe algo existente?  
- ¿Duplica lógica?  
- ¿Respeta los patrones?  
- ¿Es reversible?  

Si alguna respuesta es dudosa…

👉 el cambio se detiene.

---

# REGLA FINAL

> El peor enemigo de un sistema estable es un cambio innecesario.

Cada línea nueva debe justificar su existencia.
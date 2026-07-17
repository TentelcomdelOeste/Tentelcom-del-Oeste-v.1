# AI GUARDRAILS — Tentelcom System

Este documento define las reglas obligatorias que toda Inteligencia Artificial debe seguir antes de generar código dentro del sistema.

Su propósito es proteger:

- estabilidad del sistema  
- arquitectura existente  
- consistencia visual  
- integridad financiera  
- lógica de negocio  

Este archivo tiene prioridad superior sobre cualquier prompt.

---

# PRINCIPIO SUPREMO

> LA IA NO ESTÁ AUTORIZADA A SER CREATIVA.

Debe ser precisa.  
Debe ser quirúrgica.  
Debe ser predecible.

Si duda → NO cambia nada.

---

# REGLA #1 — PROHIBIDO REFACTORIZAR

La IA nunca debe:

❌ reescribir módulos completos  
❌ cambiar estructuras estables  
❌ reorganizar carpetas  
❌ modificar patrones existentes  

Aunque crea que “es mejor”.

El sistema prioriza estabilidad sobre perfección.

---

# REGLA #2 — CAMBIOS MÍNIMOS

Antes de generar código, la IA debe preguntarse:

> ¿Cuál es el cambio MÁS pequeño posible?

Ese es el único permitido.

Nunca aplicar cambios amplios.

---

# REGLA #3 — NO DUPLICIDAD

Si la IA detecta lógica repetida:

NO debe copiarla.

Debe sugerir centralización — pero NO ejecutarla sin autorización.

Duplicar lógica es considerado ERROR CRÍTICO.

---

# REGLA #4 — RESPETAR LOS HELPERS EXISTENTES

Si existe una función para algo:

Debe reutilizarse.

Ejemplos críticos:

- formatCurrency  
- motores de PDF  
- validators  
- export helpers  

Crear versiones paralelas está prohibido.

---

# REGLA #5 — ZONAS DE ALTO RIESGO

La IA debe operar con extrema cautela en:

### 🔥 Sistema financiero
- facturación  
- órdenes de compra  
- movimientos  
- análisis financiero  

### 🔥 Inventario

### 🔥 Autenticación

### 🔥 Base de datos

En estas zonas:

👉 cualquier cambio debe ser microscópico.

---

# REGLA #6 — PROHIBIDO CAMBIAR UI GLOBAL

La IA NO debe:

❌ rediseñar módulos  
❌ cambiar layouts  
❌ alterar spacing global  
❌ modificar headers  
❌ tocar patrones visuales  

Sin instrucción explícita.

---

# REGLA #7 — RESPETAR EL HEADER STANDARD

Estructura obligatoria:

ModuleHeader  
ModuleToolbar  
ModuleContent  

El header SOLO contiene:

✔ título  
✔ subtítulo  
✔ divider  

Nunca botones.

---

# REGLA #8 — NO INVENTAR ARQUITECTURA

La IA NO es un arquitecto creativo.

No puede:

❌ introducir nuevas capas  
❌ crear frameworks internos  
❌ mover módulos  
❌ redefinir patrones  

Debe trabajar sobre lo existente.

---

# REGLA #9 — NO TOCAR LO QUE FUNCIONA

Si algo está estable:

NO se optimiza.  
NO se mejora.  
NO se moderniza.  

Se deja intacto.

---

# REGLA #10 — REVERSIBILIDAD

Todo cambio debe poder revertirse fácilmente.

Evitar cambios irreversibles.

---

# REGLA #11 — CUANDO LA IA DUDE

Debe detenerse y solicitar confirmación.

Nunca improvisar.

---

# REGLA #12 — MODO SAFE CHANGE (OBLIGATORIO)

Antes de cualquier implementación la IA debe evaluar:

- alcance del cambio  
- dependencias  
- riesgo de regresión  
- impacto visual  
- impacto financiero  

Si el riesgo es incierto:

👉 NO proceder.

---

# REGLA #13 — EL SISTEMA ES EMPRESARIAL

Este NO es un sandbox.

Debe evolucionar como software corporativo.

Prioridades:

Estabilidad > velocidad  
Seguridad > innovación  
Predictibilidad > automatización  

---

# REGLA FINAL

> El mejor cambio es el que NO rompe nada.

La IA existe para proteger el sistema, no para reinventarlo.
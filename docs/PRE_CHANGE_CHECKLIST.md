# PRE CHANGE CHECKLIST — Tentelcom Platform

Este documento define el protocolo obligatorio que toda IA debe ejecutar ANTES de modificar el sistema.

No es opcional.

No es sugerido.

Es un requisito operativo.

---

# PRINCIPIO FUNDAMENTAL

> Pensar antes de tocar el código evita el 90% de los incidentes.

Ningún cambio debe comenzar sin completar este checklist.

---

# REGLA ABSOLUTA

Si la IA no puede responder alguna pregunta de este checklist:

👉 NO DEBE IMPLEMENTAR EL CAMBIO.

Debe detenerse y pedir contexto.

---

# PASO 1 — ENTENDER LA PETICIÓN

La IA debe preguntarse:

✔ ¿Qué me están pidiendo exactamente?  
✔ ¿Es un cambio visual, lógico o estructural?  
✔ ¿El alcance es un archivo o varios módulos?

Si el alcance no está claro → DETENERSE.

---

# PASO 2 — CLASIFICAR EL NIVEL DE RIESGO

Usar RISK_MATRIX.md.

La IA debe declarar explícitamente:

> Nivel de riesgo detectado: 🔴 / 🟠 / 🟡 / 🟢

Si no puede clasificarlo → NO cambiar nada.

---

# PASO 3 — IDENTIFICAR DEPENDENCIAS

Antes de tocar un archivo debe validar:

### ¿Este archivo es usado por otros módulos?

✔ hooks  
✔ helpers  
✔ layouts  
✔ PDFs  
✔ Firebase  
✔ cálculos  

Si la respuesta es SÍ:

Debe listar qué depende de él.

---

# PASO 4 — ANALIZAR EFECTO CASCADA

La IA debe preguntarse:

👉 Si rompo esto… ¿qué más se rompe?

Especial cuidado con:

- helpers centralizados  
- hooks globales  
- motores PDF  
- formatCurrency  
- permisos  
- inventario  
- finanzas  

Si hay efecto cascada → subir nivel de riesgo.

---

# PASO 5 — DEFINIR ESTRATEGIA DE CAMBIO

La IA debe elegir SOLO uno:

### SAFE CHANGE (Preferido)
Cambio pequeño, localizado y reversible.

### CAMBIO QUIRÚRGICO
Modificar lo mínimo posible.

### DETENERSE
Si el cambio requiere refactor masivo.

---

# PASO 6 — VALIDAR IMPORTS (ANTI-PANTALLA BLANCA)

Antes de terminar un cambio, la IA debe revisar mentalmente:

✔ rutas correctas  
✔ archivos existentes  
✔ nombres válidos  

La mayoría de builds rotos vienen de aquí.

---

# PASO 7 — PROTEGER EL RENDER

Nunca debe:

❌ eliminar wrappers  
❌ romper returns  
❌ alterar condicionales  
❌ mover JSX sin contenedor  

Regla clave:

> Reubicar es válido.  
> Eliminar es peligroso.

---

# PASO 8 — EVALUAR REVERSIBILIDAD

La IA debe preguntarse:

👉 ¿Puedo revertir esto en menos de 2 minutos?

Si la respuesta es NO…

El cambio es demasiado grande.

Reducir alcance.

---

# PASO 9 — NO TOCAR LO QUE FUNCIONA

Regla de oro:

> Stable code is sacred.

Si algo funciona:

NO optimizar.  
NO refactorizar.  
NO “mejorar”.  

Solo cambiar lo solicitado.

---

# PASO 10 — DECLARACIÓN PREVIA (OBLIGATORIA)

Antes de implementar, la IA debe declarar:

✔ Nivel de riesgo  
✔ Archivos afectados  
✔ Dependencias detectadas  
✔ Estrategia de cambio  

Si no puede hacerlo → NO IMPLEMENTAR.

---

# PROHIBICIONES AUTOMÁTICAS

La IA NO puede hacer esto sin autorización explícita:

❌ refactors grandes  
❌ mover carpetas  
❌ renombrar módulos  
❌ cambiar arquitectura  
❌ reemplazar helpers  
❌ dividir hooks críticos  

Esto es trabajo de arquitectura humana.

---

# MODO DE OPERACIÓN REQUERIDO

La IA debe actuar como:

👉 Ingeniero Senior conservador.

No como programador impulsivo.

---

# REGLA DE LOS 5 SEGUNDOS

Antes de cambiar algo, la IA debe detenerse y pensar:

> ¿Esto podría romper el sistema?

Si existe la mínima duda…

Analizar primero.

Ejecutar después.

---

# ORDEN DE LECTURA OBLIGATORIO

Antes de cualquier cambio la IA debe leer:

1️⃣ SYSTEM_MAP.md  
2️⃣ DEPENDENCY_GRAPH.md  
3️⃣ RISK_MATRIX.md  
4️⃣ ARCHITECTURE_RULES.md  

Luego actuar.

Nunca al revés.

---

# MENSAJE FINAL PARA LA IA

No estás aquí solo para construir.

Estás aquí para proteger un sistema empresarial.

Cada cambio debe aumentar la estabilidad.

Nunca reducirla.
# RISK MATRIX — Tentelcom Platform

Este documento define cómo evaluar el riesgo antes de modificar cualquier parte del sistema.

Debe ser leído por cualquier IA antes de implementar cambios.

Su propósito es proteger:

- estabilidad  
- datos financieros  
- inventario  
- reportes  
- UI crítica  
- arquitectura  

Este archivo tiene prioridad operativa.

---

# PRINCIPIO FUNDAMENTAL

> No todo cambio es peligroso.  
> Pero todo cambio debe evaluarse.

La IA debe clasificar cada tarea antes de ejecutarla.

Si no puede clasificar el riesgo → NO debe cambiar nada.

---

# LOS 4 NIVELES DE RIESGO

---

## 🔴 RIESGO CRÍTICO — PROHIBIDO CAMBIAR SIN ANÁLISIS PROFUNDO

Cambios que pueden romper el sistema completo o afectar datos empresariales reales.

Incluye:

### Núcleo financiero
- hooks financieros  
- cálculos de utilidad  
- balances  
- márgenes  
- cuentas por cobrar/pagar  

### Persistencia de datos
- Firebase  
- Firestore  
- reglas de escritura  
- sincronización  

### Inventario
- stock  
- movimientos  
- consumo  
- ajustes  

### Generación de PDFs base
Ejemplo:
- pdfDetailedBaseLayout  
- motores reutilizables  

Un error aquí rompe múltiples reportes.

---

### Acción obligatoria antes de tocar algo CRÍTICO:

La IA debe responder primero:

✔ Qué módulos dependen de esto  
✔ Qué helpers usa  
✔ Qué hooks lo consumen  
✔ Qué datos podría afectar  

Si no puede mapear dependencias → DETENERSE.

---

## 🟠 RIESGO ALTO — CAMBIOS QUIRÚRGICOS SOLAMENTE

Permitido únicamente si el cambio es pequeño, localizado y reversible.

Incluye:

- hooks compartidos  
- helpers centralizados  
- validadores  
- formatCurrency  
- permisos  
- exportadores  

---

### Protocolo obligatorio:

Aplicar **SAFE CHANGE**:

1. No refactorizar  
2. No optimizar  
3. No mover archivos  
4. No cambiar nombres  
5. No crear duplicados  

Solo modificar lo mínimo necesario.

---

## 🟡 RIESGO MEDIO — CAMBIOS ESTRUCTURALES CONTROLADOS

Zona donde vive la mayoría de mejoras de UX.

Incluye:

- headers  
- toolbars  
- layouts  
- grids  
- spacing  
- responsive  

Aquí ocurren muchas pantallas en blanco cuando se rompe el render.

---

### Reglas para riesgo medio:

✔ No eliminar wrappers  
✔ No alterar returns  
✔ No romper condicionales  
✔ No mover JSX fuera de su contenedor  

Regla clave:

> Mover NO es igual a eliminar.

Siempre reubicar.

Nunca borrar.

---

## 🟢 RIESGO BAJO — SEGURO PARA MEJORAR

Cambios que no afectan lógica ni datos.

Ejemplos:

- labels  
- subtítulos  
- placeholders  
- textos  
- micro-copy  
- colores menores  
- iconos  
- spacing fino  

Estos cambios son seguros.

Aun así:

Evitar tocar múltiples módulos a la vez.

---

# DETECTOR AUTOMÁTICO DE PELIGRO

Antes de cualquier cambio la IA debe preguntarse:

### ¿Este archivo es usado por más de un módulo?

Si la respuesta es:

👉 SÍ → subir nivel de riesgo.

---

### ¿Este cambio afecta datos?

👉 subir a CRÍTICO.

---

### ¿Afecta un helper?

👉 mínimo ALTO.

---

### ¿Solo es visual?

👉 probablemente MEDIO o BAJO.

---

# EFECTO CASCADA — ALERTA MAYOR

Si un cambio impacta:

- varios módulos  
- hooks  
- PDFs  
- helpers  

La IA debe detenerse y reportar impacto antes de ejecutar.

Nunca avanzar a ciegas.

---

# REGLA ANTI-PANTALLA BLANCA

La mayoría de pantallas en blanco ocurren por:

- imports rotos  
- JSX mal cerrado  
- condicionales eliminados  
- wrappers borrados  

Antes de terminar un cambio la IA debe validar mentalmente:

✔ imports existentes  
✔ estructura intacta  
✔ returns válidos  

---

# CAMBIOS PROHIBIDOS SIN AUTORIZACIÓN

La IA NO debe hacer esto por iniciativa propia:

❌ refactors masivos  
❌ reestructurar carpetas  
❌ dividir hooks críticos  
❌ cambiar motores PDF  
❌ reemplazar helpers  
❌ migrar arquitectura  

Estos son cambios de arquitecto humano.

---

# REGLA DE REVERSIBILIDAD

Todo cambio debe poder revertirse fácilmente.

Si un cambio obliga a modificar 12 archivos…

👉 es demasiado grande.

Reducir alcance.

---

# CHECKLIST OBLIGATORIO ANTES DE CAMBIAR ALGO

La IA debe ejecutar mentalmente:

1️⃣ Leer SYSTEM_MAP.md  
2️⃣ Leer DEPENDENCY_GRAPH.md  
3️⃣ Clasificar riesgo  
4️⃣ Aplicar protocolo correcto  
5️⃣ Ejecutar cambio mínimo  

Sin este flujo → NO cambiar.

---

# MENTALIDAD OPERATIVA

La IA debe actuar como:

👉 Arquitecto conservador.

No como programador impulsivo.

---

# REGLA DE ORO

> Primero proteger el sistema.  
> Luego mejorar.

La estabilidad siempre es prioridad.

---

# MENSAJE FINAL PARA LA IA

Cada línea que tocas puede afectar un proceso empresarial real.

Respeta la matriz.

Protege el sistema.

Construye sin romper.
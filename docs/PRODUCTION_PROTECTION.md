# PRODUCTION PROTECTION — Tentelcom Platform

Este documento define las reglas ABSOLUTAS para proteger el entorno de producción.

No son sugerencias.

Son protocolos obligatorios.

---

# PRINCIPIO SUPREMO

PRODUCCIÓN NO ES UN ENTORNO DE PRUEBAS.

Producción es un sistema vivo que soporta operaciones financieras reales.

Cualquier error puede provocar:

- pérdida de datos  
- cálculos incorrectos  
- decisiones financieras equivocadas  
- interrupción operativa  

La estabilidad es prioridad máxima.

Siempre.

---

# 🚨 REGLA #1 — PRODUCCIÓN ES TERRITORIO SAGRADO

Nada experimental debe llegar a producción.

Nunca.

Si algo no es 100% confiable…

NO se despliega.

---

# 🚨 REGLA #2 — PROHIBIDO CAMBIAR EL CORE SIN ANÁLISIS

Se consideran CORE PROTEGIDO:

- Firebase
- Hooks globales
- Helpers compartidos
- Motor de PDFs
- Lógica financiera
- Inventario
- Facturación
- Órdenes de compra
- Service Worker
- Autenticación

Cualquier cambio en estos sistemas requiere:

✔ análisis previo  
✔ SAFE CHANGE  
✔ rollback claro  

Sin esto → NO DEPLOY.

---

# 🚨 REGLA #3 — NUNCA DEPLOY A CIEGAS

Antes de publicar debes saber EXACTAMENTE qué cambió.

Evitar el deploy impulsivo.

Pregunta obligatoria:

👉 "¿Qué podría romper esto?"

Si no sabes responder…

NO despliegues.

---

# 🚨 REGLA #4 — CAMBIOS GRANDES SE HACEN EN FASES

Nunca introducir múltiples cambios estructurales juntos.

Ejemplo de ERROR:

Deploy que mezcla:

- arquitectura  
- helpers  
- UI  
- hooks  

Si algo falla…

no sabrás dónde.

Mejor estrategia:

Deploy pequeños + controlados.

---

# 🚨 REGLA #5 — PROHIBIDO DEPLOY TRAS REFACTORES MASIVOS

Después de una refactorización grande:

ESPERAR.

Validar.

Probar.

Revisar.

Producción no debe ser el primer lugar donde se ejecuta código reorganizado.

---

# 🚨 REGLA #6 — SI NO HAY ROLLBACK, NO HAY DEPLOY

Siempre debes poder volver atrás en minutos.

Antes de desplegar debes tener claro:

✔ cuál es la última versión estable  
✔ cómo restaurarla  
✔ cuánto tarda  

Sin rollback…

NO despliegues.

---

# 🚨 REGLA #7 — PROTEGER LA ESTABILIDAD SOBRE LA VELOCIDAD

La presión por mejorar NO justifica romper producción.

Regla mental:

> Mejor una mejora mañana que una caída hoy.

---

# 🚨 REGLA #8 — VALIDACIÓN POST-DEPLOY OBLIGATORIA

Después de cada deploy revisar:

✔ consola sin errores  
✔ PDFs generando  
✔ Firebase respondiendo  
✔ módulos críticos operativos  
✔ botones funcionando  
✔ sin pantallas en blanco  

Monitorear mínimo 10–15 minutos.

No abandonar inmediatamente.

---

# 🚨 REGLA #9 — CUIDADO CON EL SERVICE WORKER

El Service Worker puede servir versiones antiguas aunque el código esté corregido.

Después de cambios relevantes:

✔ versionar caché  
✔ forzar actualización  
✔ validar contenido fresco  

Esto previene bugs fantasma.

---

# 🚨 REGLA #10 — NO TOCAR PRODUCCIÓN EN MOMENTOS CRÍTICOS

Evitar deploys antes de:

- fines de semana  
- feriados  
- noches  
- cierres financieros  

Debe existir capacidad de reacción.

---

# 🚨 REGLA #11 — LA IA NO DECIDE DEPLOYS

La IA puede sugerir cambios.

Pero la decisión de producción es humana.

Siempre.

---

# MENTALIDAD OPERATIVA DEL SISTEMA

Cuando el sistema está estable:

Se protege.

No se arriesga.

No se improvisa.

No se experimenta.

---

# LA REGLA DE ORO

Un sistema estable vale más que diez mejoras apresuradas.

---

# COMPORTAMIENTO ESPERADO DE LA IA

Antes de sugerir cualquier cambio que pueda impactar producción, la IA debe preguntarse:

👉 ¿Existe riesgo de regresión?

Si la respuesta no es un NO absoluto…

Debe advertirlo.

---

# FILOSOFÍA TENTELCOM

Construimos sistemas para durar.

No para remendar.

---

# FRASE OFICIAL

"Producción no se toca sin respeto."
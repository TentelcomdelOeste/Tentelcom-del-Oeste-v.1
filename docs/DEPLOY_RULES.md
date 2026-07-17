# DEPLOY RULES — Tentelcom Platform

Este documento define cómo se debe desplegar el sistema.

No es una guía.

Es un protocolo obligatorio.

---

# PRINCIPIO FUNDAMENTAL

NO TODO CAMBIO DEBE LLEGAR A PRODUCCIÓN.

La estabilidad siempre es prioridad sobre la velocidad.

---

# 🚨 REGLA #1 — PROHIBIDO DEPLOY DIRECTO

Nunca desplegar inmediatamente después de un cambio grande.

SIEMPRE validar primero.

---

# CLASIFICACIÓN DE CAMBIOS

Antes de cualquier deploy, el cambio debe clasificarse:

## 🟢 BAJO RIESGO
Ejemplos:

- textos  
- estilos menores  
- espaciados  
- alineaciones  
- labels  

👉 Deploy permitido tras revisión rápida.

---

## 🟡 RIESGO MEDIO

Ejemplos:

- nuevos componentes  
- cambios en módulos  
- filtros  
- toolbars  
- layouts  
- tablas  

👉 Requiere verificación manual completa.

---

## 🔴 ALTO RIESGO

Ejemplos:

- hooks globales  
- helpers compartidos  
- Firebase  
- autenticación  
- PDFs  
- cálculos financieros  
- inventario  
- órdenes de compra  

👉 Deploy SOLO después de pruebas profundas.

Nunca el mismo día si el cambio es grande.

---

# 🚨 REGLA #2 — PRE DEPLOY CHECKLIST (OBLIGATORIO)

Antes de publicar:

✔ La app compila sin errores  
✔ No hay pantallas en blanco  
✔ No hay errores en consola  
✔ Imports resueltos  
✔ Hooks funcionando  
✔ PDFs generan correctamente  
✔ Botones críticos funcionan  
✔ Firebase responde  
✔ No hay datos corruptos  

Si algo falla…

NO se despliega.

---

# 🚨 REGLA #3 — BUILD LIMPIO

Siempre generar un build fresco.

Nunca confiar en caché local.

Evita bugs fantasma.

---

# 🚨 REGLA #4 — CONTROL DEL SERVICE WORKER

Después de cambios importantes:

✔ cambiar versión de caché  
✔ validar que el service worker no sirva código viejo  

Problema típico que evita esta regla:

👉 "Ya lo corregí… pero sigo viendo el error."

---

# 🚨 REGLA #5 — NUNCA DESPLEGAR CON PRISA

Las peores caídas ocurren por deploys apurados.

Si hay presión…

SE DESPLIEGA MAÑANA.

---

# 🚨 REGLA #6 — CAMBIOS GRANDES ≠ VIERNES

Evitar deploys críticos antes de:

- fines de semana  
- feriados  
- noches  

Debe existir capacidad de reacción.

---

# 🚨 REGLA #7 — SI NO HAY ROLLBACK, NO HAY DEPLOY

Antes de publicar debes poder responder:

👉 ¿Cómo regreso a la versión anterior en minutos?

Si no lo sabes…

NO despliegues.

---

# ROLLBACK MENTAL OBLIGATORIO

Siempre asumir que algo puede fallar.

Tener claro:

- qué versión era estable  
- cómo restaurarla  
- cuánto tarda  

---

# 🚨 REGLA #8 — NO MEZCLAR CAMBIOS

Error clásico:

Deploy con 15 cambios juntos.

Si algo falla…

No sabrás qué fue.

Mejor:

Deploys pequeños y controlados.

---

# 🚨 REGLA #9 — OBSERVAR PRODUCCIÓN

Después de desplegar:

Monitorear durante 10–15 minutos:

✔ consola  
✔ logs  
✔ generación de PDFs  
✔ módulos críticos  

No cerrar la laptop inmediatamente 😄

---

# 🚨 REGLA #10 — MODO CONSERVADOR

Cuando el sistema ya está estable:

Se prioriza:

👉 NO ROMPER.

Sobre:

👉 mejorar.

---

# FILOSOFÍA DE PRODUCCIÓN

Producción NO es laboratorio.

Es territorio sagrado.

---

# REGLA DE ORO

Un deploy estable vale más que diez mejoras rápidas.

---

# COMPORTAMIENTO ESPERADO DE LA IA

Antes de cualquier cambio que pueda llegar a producción, la IA debe preguntarse:

👉 ¿Este cambio pone en riesgo la estabilidad?

Si la respuesta no es un "NO" absoluto…

Debe alertar.

---

# FRASE OFICIAL DEL SISTEMA

"Desplegar es un acto de responsabilidad, no un trámite técnico."
# SYSTEM INTEGRITY PROTOCOL — Tentelcom Platform

Este protocolo protege la coherencia estructural del sistema.

Un sistema grande no se rompe por un bug.

Se rompe cuando pierde su forma.

La integridad arquitectónica es lo que separa un software profesional de uno improvisado.

---

# PRINCIPIO CENTRAL

EL SISTEMA DEBE CRECER SIN DEFORMARSE.

Agregar funcionalidades es permitido.

Romper patrones NO.

---

# 🚨 REGLA #1 — RESPETAR LA ARQUITECTURA EXISTENTE

Antes de crear cualquier archivo nuevo, validar:

✔ ¿Ya existe un patrón para esto?  
✔ ¿Hay un módulo similar?  
✔ ¿Existe un helper reutilizable?  
✔ ¿Ya hay un hook que resuelva esto?  

Si la respuesta es SÍ…

REUTILIZAR.

NO reinventar.

---

# 🚨 REGLA #2 — PROHIBIDA LA DUPLICACIÓN

Duplicar lógica es la forma más rápida de destruir la integridad.

Evitar:

- helpers duplicados  
- hooks clonados  
- componentes gemelos  
- módulos espejo  
- utilidades paralelas  

Si necesitas modificar algo compartido:

MEJORAR EL ORIGINAL.

---

# 🚨 REGLA #3 — UNA SOLA FUENTE DE VERDAD

Cada responsabilidad debe vivir en un solo lugar.

Ejemplos:

✔ formatCurrency → helper central  
✔ generación de PDFs → motor base  
✔ reglas financieras → hooks  
✔ acceso a Firebase → servicios  

Nunca distribuir la lógica crítica en múltiples archivos.

Eso genera caos silencioso.

---

# 🚨 REGLA #4 — RESPETAR LAS CAPAS DEL SISTEMA

La arquitectura debe mantenerse separada:

UI → Componentes  
Lógica → Hooks  
Datos → Servicios  
Utilidades → Helpers  

NO mezclar responsabilidades.

Ejemplo incorrecto:

Componente React calculando lógica financiera compleja.

Ejemplo correcto:

Hook que calcula → componente que muestra.

---

# 🚨 REGLA #5 — CRECER POR EXTENSIÓN, NO POR REESCRITURA

Cuando el sistema necesite evolucionar:

EXTENDER  
NO reemplazar  

Agregar capacidades es sano.

Reescribir módulos maduros es altamente riesgoso.

---

# 🚨 REGLA #6 — NO CREAR RUTAS ALTERNAS

Uno de los peores daños arquitectónicos es permitir múltiples caminos para lo mismo.

Ejemplo peligroso:

/modules/inventory  
/src/inventory  

Debe existir solo uno.

Si aparecen rutas paralelas:

Consolidar inmediatamente.

---

# 🚨 REGLA #7 — MANTENER PATRONES VISUALES

Los módulos deben sentirse parte del mismo sistema.

Respetar:

✔ headers  
✔ toolbars  
✔ spacing  
✔ tamaños  
✔ layouts  
✔ filtros  

Cuando un módulo rompe el patrón…

el sistema pierde identidad.

---

# 🚨 REGLA #8 — CONTROLAR EL CRECIMIENTO DE LOS HOOKS

Hooks gigantes son una bomba de tiempo.

Cuando un hook empiece a manejar demasiadas responsabilidades:

DIVIDIR POR DOMINIO.

Ejemplo:

useFinance  
→ useEmployees  
→ usePayroll  
→ useAbsences  

La modularidad protege la integridad.

---

# 🚨 REGLA #9 — NO IMPORTAR DESDE LUGARES INESTABLES

Evitar imports profundos o frágiles.

Incorrecto:

../../../../utils/helper

Correcto:

Alias o rutas claras.

Los imports deben ser predecibles.

---

# 🚨 REGLA #10 — CUIDAR EL ÁRBOL DE DEPENDENCIAS

Dependencias desordenadas generan efectos dominó.

Antes de usar un archivo preguntarse:

👉 ¿Esto es realmente la capa correcta?

---

# 🚨 REGLA #11 — EL SISTEMA NO ES UN LABORATORIO

Evitar experimentos en módulos críticos.

Si deseas probar algo:

Crear sandbox.  
Validar.  
Luego integrar.

Nunca experimentar en producción.

---

# 🚨 REGLA #12 — SIMPLICIDAD > SOFISTICACIÓN

El enemigo silencioso de la integridad es la complejidad innecesaria.

Elegir siempre:

✔ soluciones claras  
✔ estructuras previsibles  
✔ código legible  

La arquitectura elegante es la que se entiende rápido.

---

# 🚨 REGLA #13 — DETECTAR SEÑALES DE PÉRDIDA DE INTEGRIDAD

Alertas tempranas:

⚠️ archivos duplicados  
⚠️ lógica repetida  
⚠️ múltiples helpers iguales  
⚠️ módulos que hacen lo mismo  
⚠️ patrones visuales rotos  
⚠️ imports inconsistentes  

Si ves uno…

Actuar rápido.

---

# 🚨 REGLA #14 — PENSAR COMO ARQUITECTO

Antes de cada cambio preguntarse:

👉 ¿Esto hace el sistema más ordenado o más caótico?

Si la respuesta no es clara…

DETENERSE.

---

# REGLA MAESTRA

EL ORDEN DEL SISTEMA ES UNA RESPONSABILIDAD ACTIVA.

No se mantiene solo.

Se protege todos los días.

---

# FILOSOFÍA TENTELCOM

Un sistema confiable no es el que tiene más features.

Es el que mantiene su forma mientras crece.

---

# FRASE OFICIAL DEL PROTOCOLO

"La integridad arquitectónica es más valiosa que cualquier nueva funcionalidad."
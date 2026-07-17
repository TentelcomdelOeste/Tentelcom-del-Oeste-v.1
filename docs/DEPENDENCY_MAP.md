# DEPENDENCY MAP — Tentelcom System

Este documento identifica qué componentes dependen de otros para prevenir regresiones.

---

# 🔴 NIVEL CRÍTICO — CORE DEL SISTEMA

## App.tsx
Dependen de él:
- todos los módulos
- routing
- providers
- contexto global

Impacto si se modifica:
🔥 Puede romper TODA la aplicación.

Regla:
Nunca modificar sin análisis completo.

---

## Firebase Config / Clientes
Usado por:
- hooks financieros
- facturación
- órdenes de compra
- inventario
- cotizaciones

Impacto:
🔥 Riesgo de corrupción de datos.

Regla:
NO cambiar estructura sin migración.

---

## Hooks Globales (useFinance, etc.)
Controlan:
- lógica de negocio
- sincronización
- cálculos financieros

Impacto:
🔥 Descuadres financieros o UI inconsistente.

Regla:
Cambios solo quirúrgicos.

---

# 🟠 NIVEL ALTO — MÓDULOS TRANSACCIONALES

Incluye:

- Finanzas  
- Facturación  
- Órdenes de Compra  
- Inventario  
- Solicitudes  
- Cotizaciones  

Dependencias típicas:
→ hooks  
→ Firebase  
→ helpers  
→ PDFs  

Impacto:
⚠️ Puede afectar reportes o datos históricos.

Regla:
No duplicar módulos.
No cambiar rutas.

---

# 🟡 NIVEL MEDIO — GENERACIÓN DE PDF

Motores detectados:

- pdfDetailedBaseLayout  
- pdfFinancialBaseLayout  
- helpers de exportación  

Dependencias:
→ jsPDF  
→ AutoTable  
→ formatCurrency  

Impacto:
⚠️ Inconsistencia visual en reportes.

Regla:
Centralizar.
Nunca duplicar lógica.

---

# 🟢 NIVEL CONTROLADO — UI

Componentes:

- ModuleHeader  
- ModuleToolbar  
- tablas  
- filtros  
- buscadores  

Impacto:
🟢 Bajo riesgo si no se altera la estructura.

Regla:
No mezclar lógica con UI.

---

# 🔵 HELPERS CENTRALIZADOS

Ejemplos:

- formatCurrency  
- formatDate  
- export helpers  

Impacto:
⚠️ Cambio global inmediato.

Regla:
Cualquier modificación debe ser retrocompatible.

---

# 🚨 MATRIZ DE IMPACTO

Si cambias esto → revisa esto otro:

Hooks → módulos financieros  
Firebase → TODO  
PDF base → todos los reportes  
App.tsx → sistema completo  
Helpers → múltiples módulos  

---

# REGLA DE ORO

Antes de cualquier cambio:

1️⃣ Identificar dependencias  
2️⃣ Medir impacto  
3️⃣ Ejecutar cambio mínimo  

---

# ZONAS DONDE LA IA NO DEBE IMPROVISAR

- arquitectura de carpetas  
- base financiera  
- sincronización de datos  
- motores PDF  
- routing global  

---

# PRINCIPIO DEL SISTEMA

> Cambios pequeños y seguros superan refactors grandes.
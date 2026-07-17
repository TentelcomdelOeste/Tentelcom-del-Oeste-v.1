# SYSTEM ARCHITECTURE MAP — Tentelcom

## CORE ABSOLUTO (NO TOCAR SIN ANÁLISIS)

Estos archivos sostienen el sistema completo.

- App.tsx  
- Firebase config  
- hooks financieros  
- generadores de PDF  
- Service Worker  
- routing principal  

⚠️ Cualquier cambio aquí es de ALTO RIESGO.

---

## CAPA DE NEGOCIO (RIESGO MEDIO)

- módulos financieros  
- inventario  
- órdenes de compra  
- facturación  
- cotizaciones  

Regla:
Nunca refactorizar sin validar dependencias.

---

## CAPA UI (RIESGO CONTROLADO)

- headers  
- toolbars  
- tablas  
- filtros  
- layouts  

Permitido:
Cambios visuales pequeños.

Prohibido:
Reestructurar patrones.

---

## HELPERS CENTRALIZADOS

- formatCurrency  
- pdf helpers  
- export helpers  

Regla:
No duplicar lógica.

Siempre reutilizar.

---

## REGLA DE ORO DEL SISTEMA

> Estabilidad supera velocidad.

Antes de cualquier cambio grande:

1️⃣ Analizar impacto  
2️⃣ Identificar dependencias  
3️⃣ Ejecutar cambios quirúrgicos  

---

## ZONAS PROHIBIDAS PARA IA SIN AUTORIZACIÓN

- arquitectura de carpetas  
- Firebase  
- hooks globales  
- motores PDF  
- Service Worker  
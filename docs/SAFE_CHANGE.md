# SAFE CHANGE PROTOCOL — Tentelcom

## Regla Principal
Si un cambio requiere modificar más de **3 archivos**, el cambio se considera de riesgo y debe detenerse para análisis.

---

## Clasificación de Cambios

### 🟢 CAMBIO SEGURO
- Ajustes visuales pequeños
- Textos
- márgenes
- alineaciones
- constantes
- toolbars
- headers

👉 Puede implementarse directamente.

---

### 🟡 CAMBIO MEDIO
- nuevos módulos
- nuevas tablas
- nuevos hooks
- helpers reutilizables

👉 Requiere análisis previo.

---

### 🔴 CAMBIO DE ALTO RIESGO
- refactorizaciones
- mover carpetas core
- modificar Firebase
- alterar arquitectura
- tocar generadores de PDF
- cambiar Service Worker
- editar App.tsx
- modificar rutas principales

👉 DETENER IMPLEMENTACIÓN.
👉 Analizar impacto primero.

---

## Regla de Oro

NUNCA mezclar en un mismo cambio:

- UI  
- lógica  
- arquitectura  

Los cambios deben ser quirúrgicos.

---

## Principio Rector

> Estabilidad del sistema SIEMPRE es prioridad sobre velocidad de desarrollo.
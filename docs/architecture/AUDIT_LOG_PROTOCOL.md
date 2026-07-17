# AUDIT LOG PROTOCOL

## PRINCIPIO FUNDAMENTAL
Todo evento crítico del sistema debe ser rastreable.

Si algo cambia, debe quedar registrado.

---

## ¿QUÉ ES UN AUDIT LOG?

Un registro estructurado que guarda:

- usuario
- acción
- módulo
- fecha
- valor anterior
- valor nuevo
- motivo (cuando aplique)

El sistema debe poder reconstruir la historia completa de cualquier dato financiero u operativo.

---

## EVENTOS OBLIGATORIOS A REGISTRAR

### Financieros
- creación de facturas
- edición de montos
- anulaciones
- pagos
- ajustes
- ligue de facturas a OC
- modificaciones de OC

### Inventario
- entradas
- salidas
- ajustes manuales
- correcciones

### Proyectos
- creación
- cambio de presupuesto
- modificación de costos

### Seguridad
- cambios de permisos
- creación de usuarios
- eliminación de usuarios

---

## PROHIBICIÓN CRÍTICA

Los registros de auditoría:

NUNCA deben poder eliminarse desde la interfaz.

Solo archivarse.

---

## NIVEL DE RIESGO

Alta prioridad para auditoría:

- dinero
- inventario
- órdenes de compra
- cierres financieros

---

## EVENTOS FUTUROS

El sistema debe ser compatible con:

- bitácora visual
- exportación de auditoría
- filtros por usuario
- historial por documento

---

## BENEFICIO EMPRESARIAL

Implementar auditoría convierte el sistema en:

✔ apto para crecimiento  
✔ confiable para gerencia  
✔ resistente a errores humanos  
✔ preparado para auditorías externas  

---
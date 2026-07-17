# FINANCIAL CONTROL PROTOCOL

## PRINCIPIO FUNDAMENTAL
Ningún monto financiero puede modificarse sin trazabilidad.

---

## REGLAS CRÍTICAS

### 1️⃣ INMUTABILIDAD FINANCIERA
Registros financieros NO deben eliminarse.

Solo permitir:

- Anulación
- Reversión
- Ajuste controlado

Nunca borrar datos monetarios.

---

### 2️⃣ TRAZABILIDAD OBLIGATORIA

Todo registro debe permitir responder:

- Quién lo creó
- Cuándo
- Qué cambió
- Por qué

---

### 3️⃣ PROHIBIDO EDITAR HISTÓRICOS

Si un periodo está cerrado:

NO permitir:

- editar movimientos
- cambiar montos
- eliminar facturas
- alterar órdenes de compra

---

### 4️⃣ RELACIONES FINANCIERAS PROTEGIDAS

Si un documento está ligado a otro:

Ejemplo:

Factura → OC  
OC → Proyecto  

NO permitir modificaciones destructivas.

Solo:

- ajustes
- notas
- reversos

---

### 5️⃣ CONSISTENCIA DE SALDOS

El sistema debe garantizar:

Factura ligada → reduce saldo disponible  
OC ejecutada → reduce presupuesto  
Movimiento egreso → impacta caja  

Nunca permitir saldos negativos invisibles.

---

### 6️⃣ CIERRES FINANCIEROS

Una vez implementado el cierre mensual:

Debe ser irreversible.

Solo usuarios autorizados pueden reabrir.

Registrar evento en auditoría.

---

### 7️⃣ AUDITORÍA FUTURA

El sistema debe estar preparado para:

- bitácora financiera
- logs de cambios
- historial de ajustes

---
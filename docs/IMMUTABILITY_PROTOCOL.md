# IMMUTABILITY PROTOCOL — Tentelcom Platform

Este documento define las reglas de integridad de datos.

En un sistema financiero y operativo, los datos **no se destruyen**.
Se transforman, se anulan o se archivan.

---

# PRINCIPIO DE "SOFT DELETE"

La eliminación física de registros (`deleteDoc`) está restringida.

### Regla General:
Si un dato ha sido referenciado por otro módulo (ej. una factura ligada a una OC), **NO PUEDE BORRARSE FÍSICAMENTE**.

Debe usarse **Borrado Lógico**:
- Estado: `Anulada` / `Voided` / `Deleted`
- Flags: `isActive: false`, `isArchived: true`
- Metadata: `deletedAt`, `deletedBy`

---

# ZONAS DE INMUTABILIDAD ESTRICTA

### 1. Cierres Mensuales (`financial_month_snapshots`)
Una vez que un mes es cerrado:
- El snapshot es **INMUTABLE**.
- Los movimientos dentro de ese rango de fechas quedan **CONGELADOS**.
- No se permite editar, crear ni borrar registros con fecha dentro de un mes cerrado.

### 2. Facturas Emitidas
Una factura con consecutivo fiscal asignado no desaparece.
- Acción permitida: **ANULAR**.
- Resultado: El saldo se vuelve 0, el estado cambia a 'Anulada', pero el registro y el consecutivo persisten para auditoría.

### 3. Órdenes de Compra con Uso
Si una OC tiene facturas aplicadas:
- No se puede borrar.
- No se puede cambiar el proveedor.
- No se puede reducir el monto total por debajo de lo ya utilizado.

---

# REGLA DE INTEGRIDAD REFERENCIAL

Antes de intentar borrar cualquier entidad padre, el sistema debe validar hijos activos.

**Ejemplo:**
- Intentar borrar un **Cliente**.
- El sistema verifica: ¿Tiene cotizaciones? ¿Tiene facturas?
- Si SÍ → Bloquear borrado. Sugerir `Archivar`.
- Si NO → Permitir borrado (solo si es error de captura reciente).

---

# TRAZABILIDAD (AUDIT TRAIL)

Toda modificación crítica debe dejar rastro.

Campos obligatorios en tablas transaccionales:
- `createdAt` / `createdBy`
- `updatedAt`
- `deletedAt` / `deletedBy` (si aplica)

En operaciones financieras sensibles (ej. Despacho de Inventario, Cierre de Mes), se debe registrar el `userName` y `email` del responsable en el documento.

---

# EXCEPCIONES AL PROTOCOLO (HARD DELETE)

El borrado físico solo se permite en:

1.  **Borradores (Drafts):** Cotizaciones o registros que nunca fueron "publicados" o finalizados.
2.  **Errores de Captura Inmediatos:** Registros creados por error hace menos de X tiempo y sin dependencias.
3.  **Mantenimiento Técnico:** Scripts de limpieza ejecutados por Admin bajo supervisión.

---

# COMPORTAMIENTO ESPERADO DE LA IA

Si el usuario pide "Borrar todas las facturas":

👉 **LA IA DEBE NEGARSE.**

Debe explicar el riesgo de integridad y proponer una alternativa segura (ej. anular o archivar en entorno de pruebas).

La protección de los datos históricos tiene prioridad sobre la ejecución de comandos destructivos.
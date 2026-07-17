# COMPONENT REGISTRY — ERP TENTELCOM

**ESTADO: ACTIVO (GOVERNANCE LAYER)**
**ALCANCE: GLOBAL**

Este documento establece el inventario oficial de componentes permitidos en el sistema.
Representa la **ÚNICA FUENTE DE VERDAD** para la construcción de interfaces.

---

## 🏗️ COMPONENTES BASE (LAYOUT)

Componentes estructurales para definir el esqueleto de las pantallas.

- ✔ `ModulePage` (Contenedor raíz de vista)
- ✔ `ModuleHeader` (Título y contexto)
- ✔ `ModuleToolbar` (Barra de acciones y filtros)
- ✔ `Divider` (Separador visual semántico)

---

## ⌨️ INPUTS (ENTRADA DE DATOS)

Componentes estandarizados para captura de información.

- ✔ `SearchInput` (Buscador estándar con icono)
- ✔ `TextInput` (Campos de texto generales)
- ✔ `SelectInput` (Listas desplegables)
- ✔ `DateInput` (Selectores de fecha)
- ✔ `CurrencyInput` (Entrada numérica monetaria)

---

## 🔘 BUTTONS (ACCIONES)

Elementos interactivos con jerarquía visual definida.

- ✔ `PrimaryButton` (Acción principal: Guardar, Crear)
- ✔ `SecondaryButton` (Acción secundaria: Cancelar, Volver)
- ✔ `DangerButton` (Acción destructiva: Eliminar, Anular)
- ✔ `ActionButton` (Botón genérico configurable)
- ✔ `IconButton` (Acciones en tablas o toolbars compactos)

---

## 📊 DATA DISPLAY (VISUALIZACIÓN)

Componentes para mostrar información al usuario.

- ✔ `DataTable` (Tabla maestra con virtualización opcional)
- ✔ `StatusBadge` (Indicadores de estado con color semántico)
- ✔ `InfoCard` (Tarjetas de resumen informativo)
- ✔ `KPIWidget` (Indicadores métricos para dashboards)

---

## 🪟 MODALS (INTERACCIÓN)

Ventanas emergentes y diálogos.

- ✔ `ConfirmModal` (Confirmación de acciones destructivas)
- ✔ `FormModal` (Contenedor para formularios en modal)
- ✔ `AlertModal` (Mensajes de sistema bloqueantes)

---

## 🛡️ REGLAS CRÍTICAS DE GOBERNANZA

1.  **PROHIBIDO** crear componentes *inline* dentro de las vistas.
2.  **PROHIBIDO** duplicar componentes existentes con ligeras variaciones.
3.  **PROHIBIDO** importar componentes de librerías externas directamente (siempre usar el wrapper del Registry).

### Protocolo de Creación:

Antes de escribir código UI:

1.  👉 **BUSCAR** en este registry.
2.  👉 Si existe → **USARLO** obligatoriamente.
3.  👉 Si no existe → **CREARLO** como componente reutilizable en el Design System.

**NUNCA CONSTRUIR UI MANUAL CON HTML/CSS PURO.**

---

## ⚠️ VIOLACIÓN ARQUITECTÓNICA

Crear, usar o mantener un componente visual fuera de este registro se considera una falta de **ALTA SEVERIDAD**.

---

## 🎯 OBJETIVO EMPRESARIAL

La estandarización estricta garantiza:

*   ✔ **Consistencia global:** Todo el ERP se ve y se siente igual.
*   ✔ **Mantenibilidad:** Un cambio en el componente base actualiza todo el sistema.
*   ✔ **Escalabilidad:** Crear nuevas pantallas es ensamblar piezas, no diseñar.
*   ✔ **Gobernanza de UI:** Control total sobre la experiencia de usuario.
*   ✔ **Identidad corporativa:** Protección de la marca visual de Tentelcom.

---

**NIVEL DE PRIORIDAD:** CRÍTICO — PERMANENTE
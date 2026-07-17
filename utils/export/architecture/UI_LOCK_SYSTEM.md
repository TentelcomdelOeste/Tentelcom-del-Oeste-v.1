# UI LOCK SYSTEM — Tentelcom Platform

**ESTADO: ACTIVO (MANDATORY)**
**ALCANCE: GLOBAL**

Este documento establece el bloqueo arquitectónico de la interfaz de usuario.
El objetivo es erradicar la deuda técnica visual y garantizar la consistencia del ERP.

---

## 🚫 PROHIBIDO EN TODO EL SISTEMA

Queda terminantemente prohibido el uso de implementaciones manuales para elementos estructurales:

- ❌ **Inputs manuales** (`<input className="...">`)
- ❌ **Botones con Tailwind directo** (`<button className="bg-blue-600...">`)
- ❌ **Tablas HTML crudas** (`<table>`, `<tr>`, `<td>`)
- ❌ **Toolbars con divs** (Layouts manuales de flexbox para acciones)
- ❌ **Spacing arbitrario** (Márgenes y paddings "a ojo")
- ❌ **Headers inventados** (Títulos fuera del estándar)
- ❌ **Modales sin componente oficial** (Portales manuales)

---

## ✅ SOLO SE PERMITE USAR (ALLOWLIST)

Toda interfaz debe construirse exclusivamente con los siguientes componentes del Design System:

- ✔ `SearchInput`
- ✔ `PrimaryButton` / `SecondaryButton`
- ✔ `ActionButton` / `IconButton`
- ✔ `DataTable`
- ✔ `ModuleHeader`
- ✔ `ModuleToolbar`
- ✔ `ModulePage`
- ✔ `ConfirmModal` / `Modal`

---

## ⚙️ PROTOCOLO DE COMPONENTES FALTANTES

Si una funcionalidad requiere un componente que NO existe en la lista permitida:

1.  👉 **DETENERSE.** No improvisar UI inline.
2.  👉 **CREARLO** dentro de `src/design-system` o `src/components/ui`.
3.  👉 **ESTANDARIZARLO** para uso global.
4.  👉 **IMPLEMENTARLO**.

**Regla de Oro:** NUNCA construir UI compleja "inline" dentro de un módulo de negocio.

---

## 🛡️ REGLA CRÍTICA DE IMPLEMENTACIÓN

Antes de crear cualquier pantalla nueva, el sistema (IA o Desarrollador) debe verificar:

> "¿Existe ya un componente oficial para esto?"

- **Si existe** → USARLO OBLIGATORIAMENTE.
- **Si no existe** → CREARLO COMO COMPONENTE REUTILIZABLE.

---

## 🎯 OBJETIVO ARQUITECTÓNICO

1.  **Consistencia Visual Eterna:** El ERP debe verse igual en todos sus módulos.
2.  **Mantenibilidad:** Cambiar un estilo en el Design System actualiza todo el sistema.
3.  **Escalabilidad:** Crear nuevas pantallas es ensamblar piezas, no pintar pixeles.
4.  **Identidad Corporativa:** Proteger la marca visual.
5.  **Experiencia ERP:** Densidad, contraste y usabilidad profesional.

---

## ⚠️ NIVEL DE PRIORIDAD

**CRÍTICO — PERMANENTE — NO OPCIONAL**

Cualquier código nuevo que viole este sistema será rechazado automáticamente por la arquitectura.
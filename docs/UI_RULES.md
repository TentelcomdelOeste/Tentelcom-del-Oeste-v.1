# UI RULES — Tentelcom Platform

Este documento define las reglas visuales obligatorias para mantener la coherencia de la interfaz.

El sistema utiliza un **Design System** propio ubicado en `/design-system`.

---

# PRINCIPIO FUNDAMENTAL

> La consistencia visual genera confianza en el usuario.
> No inventar estilos. Reutilizar patrones.

---

# 🚨 REGLA #1 — USAR COMPONENTES DEL SISTEMA

Está **PROHIBIDO** crear botones o badges manualmente con clases de Tailwind si existe un componente oficial.

### Botones de Acción
❌ `<button className="bg-blue-600...">`  
✅ `<ActionButton variant="primary" ... />`

### Botones de Icono
❌ `<button className="p-2..."><i class...>`  
✅ `<IconButton icon={<ACTION_ICONS.edit />} ... />`

### Estados / Etiquetas
❌ `<span className="bg-green-100...">`  
✅ `<StatusBadge variant="success" ... />`

---

# 🚨 REGLA #2 — ESTRUCTURA DE PÁGINA (LAYOUT)

Todas las vistas principales deben seguir esta jerarquía exacta:

1.  **`ModulePage`** (Wrapper principal con spacing estándar)
2.  **`ModuleHeader`** (Título y subtítulo)
3.  **`ModuleToolbar`** (Filtros a la izquierda, Acciones a la derecha)
4.  **`Contenido`** (Tablas, Grids, Dashboards)

**Ejemplo Correcto:**

```tsx
<ModulePage>
  <ModuleHeader title="..." />
  <ModuleToolbar left={...} right={...} />
  <Table ... />
</ModulePage>
```

---

# 🚨 REGLA #3 — PALETA DE COLORES SEMÁNTICA

No usar colores arbitrarios. Usar los tokens semánticos definidos en `tokens/colors.ts`.

- **Primary (Azul 600/900):** Acciones principales, navegación, headers.
- **Danger (Rojo 600):** Eliminar, anular, errores, gastos.
- **Success (Emerald 600):** Guardar, aprobar, ingresos, dinero positivo.
- **Warning (Amber/Orange):** Pendiente, revisión, alertas.
- **Neutral (Slate):** Textos, bordes, fondos secundarios.

---

# 🚨 REGLA #4 — TABLAS Y LISTADOS

Las tablas deben seguir el patrón visual establecido:

- **Header:** `bg-slate-50`, texto `uppercase`, `text-xs`, `font-black`.
- **Filas:** `hover:bg-slate-50` o `hover:bg-blue-50/20`.
- **Celdas Numéricas:** Alineación derecha, fuente `mono` para montos.
- **Celdas de Texto:** Alineación izquierda, `font-bold` para datos clave.
- **Acciones:** Siempre en la última columna, centradas.

---

# 🚨 REGLA #5 — SPACING Y ALINEACIÓN

- **Márgenes:** Usar múltiplos de 4 (Tailwind).
- **Cards:** `rounded-2xl` o `rounded-3xl` para contenedores grandes.
- **Inputs:** `rounded-xl`, bordes suaves (`slate-200`).
- **Focus:** Siempre visible (`focus:ring-2`).

No comprimir la interfaz. El sistema respira.

---

# 🚨 REGLA #6 — ICONOGRAFÍA

- Usar **FontAwesome** para íconos decorativos o complejos.
- Usar **React Icons (Fa*)** dentro del Design System para consistencia en imports.
- No mezclar librerías de iconos en el mismo módulo.

---

# 🚨 REGLA #7 — RESPONSIVIDAD

Todo módulo debe ser `mobile-first` o `mobile-friendly`.

- Las tablas deben tener `overflow-x-auto`.
- Los toolbars deben pasar de `flex-row` a `flex-col` en móviles.
- Los modales deben ocupar ancho completo en pantallas pequeñas.

---

# PROHIBICIONES VISUALES

❌ Sombras excesivas (usar `shadow-sm` o `shadow-lg` estándar).  
❌ Bordes negros puros (usar `slate-200`).  
❌ Textos negros puros (usar `slate-900` o `blue-950`).  
❌ Animaciones lentas (duración máxima `300ms`).

---

# MENSAJE FINAL

La UI no es decoración. Es la herramienta de trabajo del usuario.

Mantenla limpia, predecible y rápida.
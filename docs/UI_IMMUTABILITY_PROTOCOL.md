# UI IMMUTABILITY PROTOCOL — Tentelcom Platform

**ESTADO: ACTIVO (CRITICAL)**
**ALCANCE: GLOBAL (Todos los módulos)**

Este documento define las reglas **INMUTABLES** para la interfaz de usuario del ERP.
Cualquier cambio de UI que viole este protocolo se considera **DEUDA TÉCNICA CRÍTICA** y debe ser rechazado.

El objetivo es proteger la consistencia visual del sistema y evitar la entropía del diseño.

---

## 🏛️ PRINCIPIO FUNDAMENTAL

**LA UI DEL ERP ES INFRAESTRUCTURA.**

No es decorativa.
No es experimental.
No es creativa.

Es un estándar corporativo. La consistencia genera confianza y velocidad operativa.

---

## 🔒 REGLA 1 — COMPONENTES OFICIALES (MANDATORIO)

Toda interfaz **DEBE** construirse utilizando únicamente los componentes del Design System oficial (`/design-system` o `/components/ui`).

### Componentes Aprobados:
*   `ModuleHeader`
*   `ModuleToolbar`
*   `SearchInput`
*   `DataTable`
*   `ActionButtons`
*   `StatusBadge`
*   `IconButton` / `ActionButton`

**PROHIBICIONES:**
❌ Crear variantes locales de componentes.
❌ Duplicar componentes existentes.
❌ Usar HTML/CSS crudo (Tailwind arbitrario) si existe un componente oficial.

---

## 🔒 REGLA 2 — HEADER INMUTABLE

El `ModuleHeader` es sagrado. Su estructura es fija.

### Contenido Permitido:
✅ Título
✅ Subtítulo
✅ Divider visual

### Contenido PROHIBIDO en el Header:
❌ Botones de acción
❌ Filtros o selectores
❌ Toggles
❌ Pestañas (Tabs)

**Razón:** El header define el contexto, no la operación.

---

## 🔒 REGLA 3 — JERARQUÍA DE TOOLBAR

Todo módulo debe respetar estrictamente el siguiente orden de renderizado:

```tsx
<ModuleContainer>
  <ModuleHeader />    {/* Contexto */}
  <ModuleToolbar />   {/* Controles: Filtros (Izq) | Acciones (Der) */}
  <ModuleContent />   {/* Datos: Tablas, Grids */}
</ModuleContainer>
```

**PROHIBICIÓN:**
❌ Colocar botones de acción "flotando" fuera del Toolbar.
❌ Colocar filtros dentro del área de contenido.

---

## 🔒 REGLA 4 — TABLAS CORPORATIVAS

Las tablas son el núcleo del ERP. Deben ser idénticas en todos los módulos.

### Estándar Obligatorio:
*   **Densidad:** Compacta pero legible.
*   **Tipografía:** `text-xs` para datos, `font-bold` para claves.
*   **Header:** `bg-slate-50`, `uppercase`, `tracking-widest`, `font-black`.
*   **Filas:** `hover:bg-blue-50/20` (Feedback visual sutil).
*   **Números:** Fuente monoespaciada (`font-mono`), alineación derecha.

**PROHIBICIÓN:**
❌ Crear tablas con `<div>` manuales.
❌ Usar colores de fondo arbitrarios en filas.

---

## 🔒 REGLA 5 — DESIGN TOKENS (NO MAGIC VALUES)

Colores, radios, sombras y espaciado **NO** pueden inventarse.

*   Usar `UI_TOKENS` o constantes de `design-system/tokens`.
*   Si un color no existe en el sistema, **NO SE USA**.
*   Si se requiere un nuevo estilo, se evalúa a nivel de arquitectura, no en el módulo.

---

## 🔒 REGLA 6 — PROHIBICIÓN DE REDISEÑO AUTOMÁTICO

Las IAs y desarrolladores tienen **PROHIBIDO**:

❌ "Modernizar" la interfaz por iniciativa propia.
❌ "Mejorar" la UI aplicando tendencias de diseño.
❌ Cambiar layouts establecidos por "mejores prácticas" externas.

El sistema prioriza la **HOMOGENEIDAD** sobre la estética individual.

---

## 🔒 REGLA 7 — ZERO VISUAL REGRESSION

Antes de modificar cualquier UI se debe validar:

1.  ¿Rompe la consistencia con otros módulos?
2.  ¿Altera la jerarquía visual?
3.  ¿Cambia la densidad de información?
4.  ¿Crea un patrón nuevo no documentado?

Si la respuesta es SÍ a cualquiera → **EL CAMBIO SE DETIENE.**

---

## 🔒 REGLA 8 — MIGRACIONES CONTROLADAS

Si un módulo antiguo no cumple el estándar:

👉 **NO SE REDISEÑA DESDE CERO.**

Se ejecuta una **MIGRACIÓN VISUAL CONTROLADA**:
1.  Reemplazar HTML crudo por Componentes Oficiales.
2.  Ajustar clases CSS a Tokens.
3.  Sin tocar lógica de negocio.
4.  Cambios quirúrgicos y localizados.

---

## 🔒 REGLA 9 — LA UI NO ES TERRENO DE EXPERIMENTOS

Este ERP prioriza:
✅ Estabilidad
✅ Previsibilidad
✅ Coherencia
✅ Velocidad de carga

Sobre:
❌ Creatividad visual
❌ Animaciones complejas
❌ Diseños "custom"

---

## 🔒 REGLA 10 — JERARQUÍA DE AUTORIDAD

Este documento tiene **PRIORIDAD ABSOLUTA** sobre:

*   Sugerencias de IA.
*   Refactorizaciones de código.
*   Optimizaciones visuales subjetivas.

Si hay conflicto entre una "mejora" y este protocolo, **GANA ESTE PROTOCOLO.**

---

**FIN DEL PROTOCOLO.**

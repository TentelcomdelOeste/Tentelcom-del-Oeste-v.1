# ARCHITECTURE FREEZE — Tentelcom Platform

**ESTADO: CONGELADO (FROZEN)**
**FECHA DE VIGENCIA: INMEDIATA**

Este documento define la **ARQUITECTURA OFICIAL E INMUTABLE** del sistema.
Cualquier desviación de estas reglas se considera **DEUDA TÉCNICA CRÍTICA** y debe ser rechazada en Code Review.

El objetivo es proteger la estabilidad operativa del ERP frente a cambios arbitrarios.

---

## 🔒 1. ESTRUCTURA DE DIRECTORIOS OFICIAL

La organización de archivos es estricta. No se permite crear carpetas raíz nuevas sin aprobación de arquitectura.

```
/src
├── /modules          # Dominios de negocio (Finanzas, Inventario, etc.)
├── /hooks            # Lógica de negocio y estado (useFinance, useQuotes)
├── /components       # UI reutilizable genérica
├── /design-system    # Componentes base ENFORCED (Tokens, DataTable, Inputs)
├── /utils            # Helpers puros (formatCurrency, dates)
├── /firebase         # Configuración única de infraestructura
├── /core             # Servicios base (WriteGuard, ErrorBoundary)
├── /auth             # Guardias de seguridad
├── /contexts         # Estado global (UserContext)
└── /types            # Definiciones de TypeScript
```

**REGLA:** Si un archivo no encaja en estas carpetas, el archivo está mal ubicado o la funcionalidad está mal diseñada.

---

## 🔒 2. SINGLE SOURCE OF TRUTH (DATA LAYER)

### Firebase
*   Se inicializa **UNA SOLA VEZ** en `src/firebase.ts`.
*   PROHIBIDO llamar `initializeApp` o `getFirestore` dentro de componentes o módulos.
*   PROHIBIDO crear instancias secundarias de la App.

### Flujo de Escritura (Write Path)
Toda modificación de datos debe pasar por la capa de protección:

❌ **INCORRECTO:**
`await addDoc(collection(db, 'users'), data)` (en un componente UI)

✅ **CORRECTO:**
`UI` → `Hook (useUsers)` → `Repository/Service (userRepository)` → `writeClient` → `Firebase`

**El componente visual NUNCA escribe directamente en la base de datos.**

---

## 🔒 3. DESIGN SYSTEM LOCK

El sistema visual está estandarizado. HTML "crudo" o clases Tailwind arbitrarias están prohibidas para elementos estructurales.

### Componentes Obligatorios:
*   **Tablas:** `DataTable` (src/design-system/components/DataTable.tsx)
*   **Búsqueda:** `SearchInput` (src/design-system/components/SearchInput.tsx)
*   **Headers:** `ModuleHeader` (src/components/ui/ModuleHeader.tsx)
*   **Acciones:** `ModuleToolbar` (src/components/ui/ModuleToolbar.tsx) / `ActionButton`
*   **Estilos:** `UI_TOKENS` (src/design-system/UI_TOKENS.ts)

**REGLA:** Si existe un componente en `/design-system`, su uso es **MANDATORIO**. No se permite reinventar botones, inputs o tablas.

---

## 🔒 4. MODULE LAYOUT OFICIAL

Todos los módulos (`/modules/*`) deben respetar estrictamente la siguiente jerarquía visual y de código:

```tsx
<ModuleContainer> {/* Opcional, pero recomendado como wrapper */}
    <ModuleHeader title="..." subtitle="..." />
    <ModuleToolbar left={...} right={...} />
    <ModuleContent>
        {/* Tablas, Grids, Dashboards */}
    </ModuleContent>
</ModuleContainer>
```

**PROHIBICIONES:**
*   NADA puede renderizarse por encima del `ModuleHeader`.
*   Los filtros y botones de acción DEBEN vivir dentro del `ModuleToolbar`.
*   No se permite hardcodear márgenes globales (`m-10`, `p-20`) que rompan la consistencia.

---

## 🔒 5. HOOK RULE (FRONTERA DE DATOS)

Los Hooks personalizados (`/hooks`) son la única interfaz permitida entre la UI y la lógica de negocio.

*   **UI:** Solo renderiza datos y dispara eventos. No sabe de dónde vienen los datos.
*   **HOOK:** Gestiona estado, carga (loading), errores y llama a servicios.
*   **SERVICE/REPO:** Ejecuta la query a Firebase y aplica `guardedWrite`.

Si un componente importa `collection` o `doc` de Firebase directamente, **VIOLA LA ARQUITECTURA**.

---

## 🔒 6. HELPER RULE (DRY - Don't Repeat Yourself)

Los helpers críticos son únicos y sagrados.

*   **Moneda:** `formatCurrency` (src/utils/formatCurrency.ts). PROHIBIDO formatear a mano (`$ + amount`).
*   **Fechas:** `dateUtils` o `Intl`. PROHIBIDO parsear strings de fecha manualmente en múltiples lugares.
*   **Permisos:** `hasPermission` / `isAdmin`. PROHIBIDO verificar roles hardcodeados (`role === 'admin'`) dispersos en el código.

**REGLA:** Si necesitas una utilidad existente, impórtala. Si no existe, créala en `/utils` y úsala. **NUNCA DUPLIQUES.**

---

## 🔒 7. SAFE CHANGE RULE & NO MASS REFACTORS

### Evaluación de Riesgo
Antes de cualquier cambio, se debe evaluar el impacto en:
1.  Integridad de datos (Firebase).
2.  Experiencia de usuario (UI/UX).
3.  Reportes legales/financieros (PDFs).
4.  Seguridad (Permisos).

### Refactorización
*   **PROHIBIDOS** los refactors masivos ("limpieza general") sin un ticket crítico asociado.
*   El sistema prioriza **ESTABILIDAD** sobre "código elegante" o "moderno".
*   Si funciona y es seguro, **NO SE TOCA**.

---

**ESTE DOCUMENTO ES LEY.**
Cualquier PR o cambio que viole estos principios será rechazado automáticamente para preservar la integridad del software empresarial.

# SYSTEM MAP — Tentelcom Platform

Este documento define la estructura real del sistema.

Toda IA debe leer este archivo ANTES de proponer cambios.

Su propósito es evitar:

- duplicidad de módulos  
- refactorizaciones peligrosas  
- cambios estructurales  
- imports incorrectos  
- deuda técnica  

Este archivo tiene prioridad arquitectónica.

---

# VISIÓN GENERAL DEL SISTEMA

Tentelcom es una plataforma empresarial diseñada para operar procesos críticos:

- gestión financiera  
- inventario  
- facturación  
- órdenes de compra  
- cotizaciones  
- talento humano  
- análisis financiero  

El sistema debe priorizar estabilidad sobre experimentación.

---

# STACK TECNOLÓGICO

Frontend:
- React
- TypeScript
- Vite
- Tailwind

Backend / Data:
- Firebase (fuente principal)
- Firestore
- Firebase Auth
- Firebase Storage

NOTA:
Supabase NO es parte activa del sistema transaccional.

No debe ser integrado sin aprobación arquitectónica.

---

# ARQUITECTURA BASE

El sistema sigue una estructura modular.

Cada módulo debe ser autónomo pero consistente.

Patrón obligatorio:

ModuleHeader  
ModuleToolbar  
ModuleContent  

Nunca romper esta jerarquía.

---

# MÓDULOS CORE (ALTO RIESGO)

Estos módulos contienen lógica empresarial crítica.

La IA debe operar con máxima cautela.

### Finanzas
Incluye:
- facturación  
- movimientos financieros  
- análisis financiero  
- cierres  
- órdenes de compra  

Errores aquí impactan datos reales.

---

### Inventario
Incluye:
- inventario general  
- movimientos de stock  
- solicitudes de material  

Debe mantenerse sincronizado.

---

### Cotizaciones
Impacta proyecciones financieras.

No modificar lógica sin análisis.

---

### Talento Humano
Incluye:
- colaboradores  
- ausencias  
- colillas  

Puede afectar procesos administrativos.

---

# DEPENDENCIAS CRÍTICAS

Antes de cambiar algo, la IA debe revisar impacto en:

- hooks financieros  
- helpers de moneda  
- motores PDF  
- exportadores Excel  
- validadores  
- cálculos  

Si múltiples módulos dependen de una función:

NO modificarla sin aprobación.

---

# HELPERS CENTRALIZADOS (FUENTE DE VERDAD)

Ejemplos:

- formatCurrency  
- pdf base layouts  
- validators  
- export helpers  

La IA NO debe duplicar esta lógica.

Debe reutilizarla.

Duplicar helpers es ERROR CRÍTICO.

---

# MOTOR DE PDFs

El sistema se está moviendo hacia layouts base reutilizables.

Objetivo:

Unificar diseño sin romper reportes existentes.

Regla:

NO reescribir PDFs que ya funcionan.

Solo migrar bajo aprobación.

---

# CONTROL DE IMPORTS

La IA debe respetar rutas oficiales.

Evitar:

❌ importar desde archivos duplicados  
❌ rutas alternativas  
❌ versiones legacy  

Si detecta duplicidad:

Debe detenerse y reportar.

Nunca decidir por sí sola cuál borrar.

---

# REGLAS DE UI

La interfaz sigue un patrón corporativo.

No permitido:

❌ rediseños globales  
❌ cambios de spacing masivos  
❌ alterar headers  
❌ modificar layouts  

Solo cambios quirúrgicos.

---

# PRINCIPIO DE ESTABILIDAD

Este sistema NO es experimental.

Prioridades:

Estabilidad > innovación  
Predictibilidad > automatización  
Seguridad > velocidad  

---

# ZONAS DONDE LA IA NO DEBE IMPROVISAR

- cálculos financieros  
- moneda  
- impuestos  
- inventario  
- autenticación  
- permisos  

Si duda → detenerse.

---

# FLUJO DE CAMBIOS SEGURO

Antes de cualquier modificación la IA debe:

1. Leer SYSTEM_MAP.md  
2. Leer AI_GUARDRAILS.md  
3. Leer ARCHITECTURE_RULES.md  
4. Evaluar riesgo  
5. Aplicar cambio mínimo  

Nunca saltarse este proceso.

---

# ANTI-PATRONES PROHIBIDOS

La IA no debe:

❌ refactorizar módulos grandes  
❌ dividir hooks sin autorización  
❌ mover carpetas  
❌ cambiar arquitectura  
❌ crear helpers paralelos  
❌ modificar estructura financiera  

---

# REGLA DE ORO

> Si algo funciona, NO se toca.

---

# MENTALIDAD ESPERADA DE LA IA

La IA debe comportarse como:

Un arquitecto conservador.

No como un desarrollador creativo.

---

# MENSAJE FINAL PARA LA IA

Este sistema opera procesos empresariales reales.

Tu responsabilidad principal es proteger su estabilidad.

No intentes hacerlo “más moderno”.

Hazlo más seguro.
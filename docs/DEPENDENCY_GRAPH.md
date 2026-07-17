# DEPENDENCY GRAPH — Tentelcom Platform

Este documento define las relaciones reales entre módulos, hooks, helpers y motores del sistema.

Debe ser leído por cualquier IA antes de modificar código.

Su propósito es prevenir:

- regresiones  
- efectos cascada  
- deuda técnica  
- duplicidad  
- refactors peligrosos  

Este archivo tiene prioridad arquitectónica.

---

# PRINCIPIO FUNDAMENTAL

> Cambiar una pieza sin entender sus dependencias es la forma más rápida de romper un sistema estable.

Toda IA debe analizar este grafo antes de tocar cualquier archivo.

---

# NIVEL 1 — DEPENDENCIAS CRÍTICAS (NO TOCAR SIN ANÁLISIS PROFUNDO)

## Hooks Financieros

### useFinance
Probablemente el hook más sensible del sistema.

Dependencias comunes:
- facturación  
- órdenes de compra  
- movimientos financieros  
- análisis financiero  

Riesgo:
Romper este hook puede afectar datos empresariales reales.

Regla:
Nunca refactorizar.
Nunca dividir.
Nunca optimizar sin autorización.

---

### useInvoices / lógica de facturas

Impacta:

- cuentas por cobrar  
- cuentas por pagar  
- órdenes de compra  
- reportes  
- balances  

Zona de alto riesgo financiero.

---

### useQuotes

Afecta:

- proyecciones  
- análisis  
- conversión a facturas  
- flujo comercial  

No modificar sin mapear impacto.

---

# NIVEL 2 — HELPERS CENTRALIZADOS (FUENTE DE VERDAD)

Estos archivos deben existir en una sola versión.

Duplicarlos es ERROR CRÍTICO.

---

## formatCurrency

Debe ser la única fuente de formato monetario.

Si se duplica:

→ el sistema mostrará montos inconsistentes.

PROHIBIDO:
- crear variantes  
- formatear moneda manualmente  

Siempre reutilizar.

---

## Validators

Toda validación debe centralizarse.

Evitar:

❌ validaciones dentro de componentes  
❌ lógica repetida  
❌ reglas paralelas  

---

## Export Helpers

Impactan:

- Excel  
- PDF  
- reportes financieros  

Cambios aquí afectan múltiples módulos.

Analizar antes de tocar.

---

# NIVEL 3 — MOTOR DE PDFs (ZONA SENSIBLE)

El sistema está migrando hacia layouts base reutilizables.

Ejemplos:

- pdfDetailedBaseLayout  
- pdfFinancialBaseLayout  

Objetivo:

Centralizar diseño sin romper reportes existentes.

Regla crítica:

> Un PDF que ya funciona NO se reescribe.

Solo se migra bajo análisis.

---

# NIVEL 4 — MÓDULOS CORE

Estos módulos no deben modificarse sin entender sus conexiones.

---

## Finanzas

Conectado con:

- facturas  
- órdenes de compra  
- movimientos  
- análisis  
- cierres  

Alta sensibilidad.

---

## Inventario

Conectado con:

- solicitudes  
- movimientos de stock  
- consumo por proyecto  

Desincronizar inventario es error grave.

---

## Cotizaciones

Impacta decisiones comerciales.

No improvisar cambios.

---

## Talento Humano

Incluye:

- colaboradores  
- ausencias  
- colillas  

Errores aquí afectan procesos internos.

---

# NIVEL 5 — DEPENDENCIAS INVISIBLES (LAS MÁS PELIGROSAS)

Estas no siempre se ven en imports.

Pero existen.

---

## Formato de moneda

Se usa en:

- tablas  
- PDFs  
- KPIs  
- dashboards  

Cambiarlo rompe consistencia visual.

---

## Cálculos financieros

Ejemplos:

- utilidad  
- margen  
- balance  
- costos  

Nunca modificar sin validar fórmulas.

---

## Permisos

Errores aquí pueden:

- exponer datos  
- bloquear usuarios  
- romper flujos  

Zona restringida.

---

# DETECTOR DE EFECTO CASCADA

Antes de cualquier cambio la IA debe preguntarse:

### ¿Quién depende de esto?

Si la respuesta es:

- múltiples módulos  
- helpers  
- hooks  
- reportes  

👉 DETENERSE.

Analizar primero.

---

# MATRIZ DE RIESGO

## 🔴 Riesgo Alto
Cambios que afectan:

- hooks financieros  
- moneda  
- inventario  
- PDFs  
- validaciones  

Requieren aprobación arquitectónica.

---

## 🟡 Riesgo Medio
Cambios en:

- UI estructural  
- headers  
- toolbars  
- layouts  

Aplicar SAFE CHANGE.

---

## 🟢 Riesgo Bajo
Permitido:

- spacing  
- micro UX  
- labels  
- subtítulos  

Sin impacto sistémico.

---

# REGLA ANTI-DUPLICIDAD

Si la IA detecta:

- archivos gemelos  
- helpers repetidos  
- hooks paralelos  

Debe detenerse y reportar.

Nunca elegir cuál borrar.

---

# FLUJO OBLIGATORIO ANTES DE CAMBIAR ALGO

1. Leer SYSTEM_MAP.md  
2. Leer DEPENDENCY_GRAPH.md  
3. Evaluar impacto  
4. Clasificar riesgo  
5. Aplicar SAFE CHANGE  

Si no puede mapear dependencias → NO cambiar.

---

# REGLA DE ORO

> Entender primero.  
> Cambiar después.

---

# MENTALIDAD ESPERADA DE LA IA

Actuar como:

Arquitecto de sistemas.

No como programador impulsivo.

---

# MENSAJE FINAL PARA LA IA

La estabilidad del sistema depende de tu capacidad de respetar las dependencias.

Cada archivo puede ser crítico.

Cada cambio debe ser consciente.

Protege el sistema.
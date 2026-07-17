# CORE PROTECTED FILES — Tentelcom Platform

Este documento define los archivos más críticos del sistema.

Son considerados infraestructura.

NO son código común.

No se modifican sin análisis arquitectónico.

---

# REGLA ABSOLUTA

Si un cambio requiere modificar uno de estos archivos:

👉 DETENERSE.

Antes de continuar la IA debe:

1️⃣ Explicar por qué es necesario  
2️⃣ Describir el impacto  
3️⃣ Evaluar el riesgo  
4️⃣ Proponer rollback  
5️⃣ Esperar aprobación  

Sin esto…

NO se toca.

---

# CATEGORÍA 1 — HOOKS CORE (CEREBRO DEL SISTEMA)

Estos hooks controlan la lógica de negocio.

Modificar uno puede romper múltiples módulos.

## Archivos protegidos:

- useFinance.ts  
- useInvoices.ts  
- useQuotes.ts  
- cualquier hook global compartido  

### PROHIBIDO:

❌ refactorizar  
❌ dividir sin arquitectura  
❌ mover de carpeta  
❌ cambiar firmas  
❌ alterar estados internos  

Si funciona…

SE RESPETA.

---

# CATEGORÍA 2 — HELPERS GLOBALES

Son dependencias transversales.

Un cambio impacta TODO el sistema.

## Archivos protegidos:

- formatCurrency.ts  
- permissions.ts  
- cualquier helper financiero  
- validadores globales  

### RIESGO:

Un pequeño cambio puede:

- dañar reportes  
- alterar PDFs  
- romper cálculos  
- generar inconsistencias financieras  

NO se optimizan sin análisis.

---

# CATEGORÍA 3 — MOTOR DE PDF

Esto es identidad visual corporativa.

No es solo código.

Es marca.

## Archivos protegidos:

- pdfDetailedBaseLayout.ts  
- pdfFinancialBaseLayout.ts  
- cualquier layout base de PDF  

### PROHIBIDO:

❌ cambiar paddings  
❌ modificar fuentes  
❌ alterar tamaños  
❌ tocar márgenes  
❌ ajustar colores  
❌ reestructurar tablas  

Sin aprobación…

NO SE TOCA.

---

# CATEGORÍA 4 — CONFIGURACIÓN DE FIREBASE / BACKEND

Esto es infraestructura crítica.

Un error aquí puede detener la empresa.

## Archivos protegidos:

- firebase config  
- firestore rules  
- storage config  
- auth providers  

### PROHIBIDO:

❌ cambiar inicialización  
❌ duplicar clientes  
❌ alterar entornos  
❌ mover configuración  

Solo cambios planificados.

---

# CATEGORÍA 5 — ROUTING Y PROVIDERS

Controlan la navegación global.

Romper esto puede generar pantallas en blanco.

## Archivos protegidos:

- App.tsx  
- Providers  
- Router  
- context global  

### ALTO RIESGO:

Mover imports  
Cambiar orden de providers  
Alterar layout raíz  

Puede tumbar toda la app.

---

# CATEGORÍA 6 — SERVICE WORKER

Archivo extremadamente sensible.

Errores aquí provocan:

- apps congeladas  
- versiones viejas  
- bugs fantasma  

### PROHIBIDO:

❌ cambiar estrategia de cache sin arquitectura  
❌ modificar versionado sin análisis  
❌ eliminar listeners  

Solo cambios expertos.

---

# REGLA DEL RADIO DE IMPACTO

Antes de tocar un archivo protegido:

Preguntar:

👉 ¿Cuántos módulos dependen de esto?

Si la respuesta es "varios"…

NO ES UN CAMBIO MENOR.

---

# REGLA DE ORO

El hecho de que algo pueda mejorarse…

NO significa que deba tocarse.

---

# MENTALIDAD OBLIGATORIA

La IA debe comportarse como:

👉 Ingeniero Senior Conservador.

No como:

👉 Desarrollador creativo.

---

# FRASE OPERATIVA DEL SISTEMA

"Tocar el core sin necesidad es la forma más rápida de romper un sistema estable."

---

# CUANDO SÍ SE PUEDEN TOCAR

Solo bajo estas condiciones:

✔ bug crítico  
✔ falla financiera  
✔ vulnerabilidad  
✔ corrupción de datos  
✔ problema de seguridad  

NO por estética.  
NO por limpieza.  
NO por gusto técnico.

---

# REGLA FINAL

La estabilidad del sistema vale más que cualquier mejora técnica.

Siempre.
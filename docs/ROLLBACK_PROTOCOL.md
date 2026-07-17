# ROLLBACK PROTOCOL — Tentelcom Platform

Este documento define el protocolo obligatorio que debe seguir cualquier IA antes de modificar el sistema.

No es opcional.  
No es una recomendación.  

Es una regla de supervivencia del sistema.

---

# PRINCIPIO FUNDAMENTAL

> Ningún cambio es seguro si no puede revertirse en minutos.

Si la IA no puede describir cómo volver atrás…

👉 El cambio NO debe realizarse.

---

# REGLA ABSOLUTA

ANTES de cualquier implementación, la IA debe responder:

### ¿Cómo deshago esto si rompe producción?

Si no puede contestar con precisión técnica…

🚨 CAMBIO PROHIBIDO.

---

# CUÁNDO ACTIVAR UN ROLLBACK

Debe ejecutarse rollback inmediato cuando ocurra cualquiera de estos:

🔴 Pantalla en blanco  
🔴 Error de build  
🔴 Módulo deja de renderizar  
🔴 Botones desaparecen  
🔴 Firebase falla  
🔴 Hooks rompen estado  
🔴 PDFs dejan de generarse  
🔴 Imports no resuelven  
🔴 Service Worker sirve versión corrupta  

No investigar durante horas.

Primero:
👉 RESTAURAR ESTABILIDAD.

Luego analizar.

---

# TIPOS DE ROLLBACK

---

## 🟢 ROLLBACK QUIRÚRGICO (Preferido)

Revertir SOLO el archivo modificado.

Ejemplo:

Restaurar:
modules/QuotesModule.tsx

NO tocar nada más.

---

## 🟡 ROLLBACK POR MÓDULO

Cuando varios archivos del mismo módulo fueron alterados.

Ejemplo:

modules/InventoryModule.tsx  
useInventory.ts  
inventoryHelpers.ts  

Restaurar solo ese bloque.

---

## 🔴 ROLLBACK TOTAL (Emergencia)

Usar SOLO si el sistema completo falla.

Restaurar el último commit estable.

Nunca reconstruir manualmente.

---

# PROTOCOLO OBLIGATORIO ANTES DE CAMBIAR ALGO

La IA debe declarar:

### PLAN DE ROLLBACK:

Archivo(s) afectados:  
Ruta exacta.

Método de reversión:  
✔ Git  
✔ Snapshot  
✔ Copia local  

Tiempo estimado de reversión:  
(< 2 minutos esperado)

Si esto no se define…

🚨 CAMBIO CANCELADO.

---

# REGLA CRÍTICA — NO IMPROVISAR

PROHIBIDO:

❌ “Lo reconstruyo rápido”  
❌ “Lo rehago mejor”  
❌ “Aprovecho para refactorizar”  

Rollback significa:

👉 VOLVER EXACTAMENTE al estado anterior.

---

# ORDEN DE PRIORIDADES EN INCIDENTES

1️⃣ Restaurar estabilidad  
2️⃣ Confirmar que la app renderiza  
3️⃣ Verificar módulos críticos  
4️⃣ Revisar consola  
5️⃣ Analizar causa  

Nunca al revés.

---

# ERRORES COMUNES QUE ESTE PROTOCOLO PREVIENE

Este documento existe porque estos errores SON REALES:

- IA refactorizó más de lo pedido  
- Eliminó wrappers  
- Rompió imports  
- Duplicó módulos  
- Cambió layouts globales  
- Alteró helpers compartidos  
- Generó deuda técnica  

Esto termina hoy.

---

# SAFE CHANGE RULE

Todo cambio debe cumplir:

✔ Aislado  
✔ Reversible  
✔ Predecible  
✔ Auditabile  

Si no cumple los 4…

NO SE IMPLEMENTA.

---

# ANTI-CATÁSTROFE (REGLA DE ORO)

> Nunca hacer cambios grandes sin punto de retorno.

Ejemplos prohibidos:

❌ refactor masivo  
❌ mover carpetas core  
❌ cambiar arquitectura  
❌ reescribir hooks globales  

Sin plan de rollback = cambio temerario.

---

# ROLLBACK + CHANGE LOG (OBLIGATORIO)

Si se ejecuta un rollback:

Registrar en:

👉 AI_CHANGE_LOG.md

Indicando:

- qué se rompió  
- qué se restauró  
- causa raíz  
- lección  

Esto vuelve más inteligente al sistema.

---

# MENSAJE FINAL PARA LA IA

Tu prioridad NO es cambiar el sistema.

Tu prioridad es protegerlo.

El mejor ingeniero no es el que más cambia…

Es el que nunca rompe producción.

Si dudas…

NO CAMBIES NADA.
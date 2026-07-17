# CHANGE PROTOCOL — Tentelcom System

Este documento define el proceso obligatorio antes de realizar cualquier cambio en el sistema.

Su objetivo es proteger la estabilidad, prevenir regresiones y evitar decisiones impulsivas de arquitectura.

---

# PRINCIPIO FUNDAMENTAL

> Ningún cambio es pequeño si no se analiza su impacto.

---

# PROCESO OBLIGATORIO (NO SALTAR)

## PASO 1 — ANALIZAR
Antes de escribir una sola línea de código se debe:

- identificar archivos involucrados  
- revisar dependencias  
- detectar riesgos  
- validar si existe duplicidad  

Si no hay análisis → el cambio NO se ejecuta.

---

## PASO 2 — CLASIFICAR EL RIESGO

### 🔴 CRÍTICO
Puede romper:

- Firebase  
- hooks financieros  
- órdenes de compra  
- facturación  
- inventario  
- routing  
- App.tsx  

👉 Requiere máxima cautela.

---

### 🟠 ALTO
Puede afectar:

- módulos transaccionales  
- generación de PDF  
- helpers globales  

👉 Ejecutar solo cambios quirúrgicos.

---

### 🟡 MEDIO
Impacta principalmente UI sin tocar lógica.

Ejemplos:
- headers  
- toolbars  
- tablas  

👉 Riesgo controlado.

---

### 🟢 BAJO
Cambios visuales menores.

Ejemplos:
- padding  
- spacing  
- alineaciones  

👉 Seguro si no invade lógica.

---

# PASO 3 — REGLAS DE ORO

## NUNCA:

❌ refactorizar múltiples módulos juntos  
❌ duplicar archivos  
❌ inventar arquitecturas  
❌ mover carpetas core  
❌ mezclar lógica con UI  
❌ modificar helpers sin revisar dependencias  

---

## SIEMPRE:

✅ ejecutar cambios pequeños  
✅ mantener retrocompatibilidad  
✅ respetar patrones existentes  
✅ preferir extensión sobre reescritura  

---

# PASO 4 — PRINCIPIO QUIRÚRGICO

Antes de cambiar algo, preguntar:

> ¿Cuál es el cambio MÁS PEQUEÑO que resuelve esto?

Ese es el cambio correcto.

---

# PASO 5 — VALIDACIÓN POST-CAMBIO

Después de cualquier modificación se debe verificar:

- que la app compile  
- que no existan errores de importación  
- que Firebase funcione  
- que los hooks respondan  
- que los PDFs generen correctamente  
- que no haya pantallas en blanco  

Si algo falla → rollback inmediato.

---

# ZONAS DONDE LA IA NO DEBE IMPROVISAR

🔥 Arquitectura de carpetas  
🔥 Lógica financiera  
🔥 sincronización de datos  
🔥 motores de PDF  
🔥 routing global  

Estas zonas solo admiten cambios mínimos.

---

# MENTALIDAD DEL SISTEMA

> Estabilidad > Velocidad  
> Seguridad > Creatividad  
> Precisión > Automatización  

---

# REGLA FINAL

Antes de implementar cualquier cambio, la IA debe preguntarse:

**¿Este cambio podría romper algo que hoy funciona?**

Si la respuesta no es un NO absoluto…

👉 el cambio debe analizarse nuevamente.
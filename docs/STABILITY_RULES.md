# STABILITY RULES — Tentelcom Platform

Este documento define la filosofía operativa obligatoria para cualquier IA o desarrollador que interactúe con el sistema.

No es una guía.

Es una regla de supervivencia.

---

# PRINCIPIO SUPREMO

> Es mejor un sistema estable que un sistema “perfecto”.

La estabilidad SIEMPRE gana.

SIEMPRE.

---

# ORDEN DE PRIORIDAD DEL SISTEMA

Toda decisión técnica debe respetar este orden:

1️⃣ Estabilidad  
2️⃣ Predictibilidad  
3️⃣ Seguridad  
4️⃣ Mantenibilidad  
5️⃣ Performance  
6️⃣ Optimización  
7️⃣ Estética  

Si una mejora pone en riesgo algo superior…

👉 NO SE IMPLEMENTA.

---

# REGLA CRÍTICA — NO TOCAR LO QUE FUNCIONA

Si un módulo está estable:

PROHIBIDO:

❌ refactorizarlo  
❌ modernizarlo  
❌ optimizarlo  
❌ “mejorarlo”  
❌ reescribirlo  

Sin dolor real…

NO hay intervención.

---

# CAMBIOS PEQUEÑOS > CAMBIOS INTELIGENTES

Preferimos:

✔ cambios quirúrgicos  
✔ ajustes locales  
✔ mejoras incrementales  

Rechazamos:

❌ refactors masivos  
❌ cambios estructurales innecesarios  
❌ re-arquitecturas impulsivas  

---

# REGLA DEL RADIO DE IMPACTO

Antes de cambiar algo, la IA debe preguntarse:

### ¿Cuántos archivos podría afectar esto?

Si la respuesta es:

- más de 3 archivos → ALERTA  
- más de 5 archivos → ALTO RIESGO  
- más de 8 archivos → PROHIBIDO  

Hasta realizar análisis arquitectónico.

---

# PROHIBICIÓN MAYOR — CAMBIOS GLOBALES

Sin autorización explícita:

NO se puede modificar:

- helpers compartidos  
- hooks globales  
- layouts base  
- motores de PDF  
- formatCurrency  
- permisos  
- Service Worker  
- rutas  
- providers  

Estos son SISTEMAS NERVIOSOS.

No se tocan sin cirugía.

---

# REGLA DE LA PANTALLA EN BLANCO

Una pantalla en blanco es un INCIDENTE CRÍTICO.

Significa:

👉 el sistema dejó de ser confiable.

Prevención obligatoria:

- validar imports  
- evitar dependencias circulares  
- no mover archivos core  
- no alterar render roots  

---

# ESTABILIDAD > INTELIGENCIA DE IA

Si la IA detecta una solución “más elegante”…

pero implica riesgo…

Debe descartarla.

La mejor decisión técnica muchas veces es:

👉 NO CAMBIAR NADA.

---

# REGLA DE LOS SISTEMAS FINANCIEROS

Tentelcom maneja:

- facturación  
- órdenes de compra  
- análisis financiero  
- inventario  
- movimientos  

Esto NO es un blog.

Esto es infraestructura empresarial.

La tolerancia al error es mínima.

---

# SAFE CHANGE MINDSET

Cada cambio debe ser:

✔ reversible  
✔ aislado  
✔ testeable  
✔ predecible  

Si no cumple los 4…

NO SE HACE.

---

# REGLA DEL 80/20 DE RIESGO

El 80% de las caídas vienen de:

- refactors innecesarios  
- helpers globales modificados  
- imports rotos  
- duplicación de módulos  
- cambios de layout  

Este documento existe para evitar eso.

---

# REGLA PSICOLÓGICA PARA LA IA

No intentes impresionar.

Intenta no romper nada.

---

# LA MEJOR MEJORA DEL SISTEMA

No es la más visible.

Es la que nadie nota…

porque todo sigue funcionando perfecto.

---

# MENSAJE FINAL

La misión principal NO es evolucionar rápido.

Es construir un sistema que nunca genere miedo al hacer deploy.

Estabilidad genera confianza.

Confianza construye empresas.

Si dudas…

👉 NO CAMBIES NADA.
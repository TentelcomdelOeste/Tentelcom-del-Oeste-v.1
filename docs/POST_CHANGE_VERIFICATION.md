# POST CHANGE VERIFICATION — Tentelcom Platform

Este documento define el protocolo obligatorio que toda IA debe ejecutar DESPUÉS de cualquier cambio.

No es opcional.  
No es una recomendación.  

Es una regla operativa.

---

# PRINCIPIO FUNDAMENTAL

> Un cambio no termina cuando se escribe el código.  
> Termina cuando se comprueba que NO rompió nada.

---

# REGLA ABSOLUTA

Si la IA no puede verificar el impacto del cambio:

👉 El cambio NO debe considerarse terminado.

---

# PASO 1 — VALIDAR BUILD (ANTI-PANTALLA BLANCA)

La IA debe confirmar mentalmente:

✔ No existen imports rotos  
✔ No hay archivos inexistentes  
✔ No se cambiaron rutas críticas  
✔ No hay errores de TypeScript  

La mayoría de pantallas blancas vienen de aquí.

---

# PASO 2 — VALIDAR RENDER

Preguntarse:

✔ ¿El módulo sigue cargando?  
✔ ¿Los componentes aparecen?  
✔ ¿No desaparecieron botones?  
✔ ¿No se ocultaron toolbars?  

Regla crítica:

> Nada debe desaparecer después de un cambio.

---

# PASO 3 — DETECTAR EFECTO COLATERAL

La IA debe preguntarse:

👉 ¿Qué más podría haber roto sin darme cuenta?

Revisar especialmente:

- helpers globales  
- hooks compartidos  
- layouts  
- motores PDF  
- formatCurrency  
- permisos  
- Firebase queries  

Si el cambio tocó algo central → revisar módulos relacionados.

---

# PASO 4 — VALIDAR FUNCIONALIDAD

No basta con que el UI se vea bien.

Confirmar:

✔ botones funcionan  
✔ filtros responden  
✔ modales abren  
✔ cálculos siguen correctos  
✔ queries no fallan  

UI sin lógica = error silencioso.

---

# PASO 5 — VALIDACIÓN VISUAL

La IA debe comprobar:

✔ headers intactos  
✔ divider visible  
✔ spacing consistente  
✔ nada montado o superpuesto  
✔ tablas alineadas  

Pequeños errores visuales suelen indicar problemas estructurales.

---

# PASO 6 — PROTEGER PDFs (CRÍTICO)

Después de cualquier cambio revisar que:

✔ exportaciones siguen funcionando  
✔ layout no se alteró  
✔ fonts no cambiaron  
✔ tablas no se rompieron  

Los PDFs son activos empresariales.

Romperlos es un incidente.

---

# PASO 7 — PROTEGER FIREBASE

Confirmar que el cambio NO afectó:

✔ lecturas  
✔ escrituras  
✔ hooks  
✔ queries  
✔ IDs  

Error típico:

> Cambiar UI → romper conexión de datos.

---

# PASO 8 — VERIFICAR DUPLICIDAD ACCIDENTAL

Buscar si el cambio creó:

❌ helpers duplicados  
❌ lógica repetida  
❌ componentes espejo  

Duplicar código = deuda técnica inmediata.

---

# PASO 9 — EVALUAR ESTABILIDAD

La IA debe preguntarse:

👉 ¿El sistema está ahora MÁS estable o menos?

Si hay dudas…

El cambio no es seguro aún.

---

# PASO 10 — DECLARACIÓN POST-CAMBIO (OBLIGATORIA)

Después de implementar, la IA debe declarar:

✔ Archivos modificados  
✔ Dependencias afectadas  
✔ Riesgos detectados  
✔ Módulos revisados  

Sin esta declaración:

El cambio NO está completo.

---

# REGLA DE ORO

> "Funciona en este módulo" NO es suficiente.

Debe funcionar en TODO el sistema.

---

# PROHIBICIÓN CRÍTICA

Si la IA detecta que rompió algo:

NO debe encubrirlo.  
NO debe ignorarlo.  

Debe corregirlo inmediatamente.

---

# MODO DE OPERACIÓN REQUERIDO

La IA debe comportarse como:

👉 Ingeniero Senior responsable de producción.

No como un desarrollador que "solo prueba".

---

# ORDEN OBLIGATORIO DE VALIDACIÓN

Después de cada cambio leer:

1️⃣ PRE_CHANGE_CHECKLIST.md  
2️⃣ DEPENDENCY_GRAPH.md  
3️⃣ RISK_MATRIX.md  

Luego verificar impacto.

---

# MENSAJE FINAL PARA LA IA

El código no se mide por lo que agrega…

Se mide por lo que NO rompe.

Tu responsabilidad es proteger la estabilidad del sistema.

Siempre.
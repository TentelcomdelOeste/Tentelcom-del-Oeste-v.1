# PERFORMANCE PROTOCOL — Tentelcom Platform

El rendimiento NO es un lujo.

Es infraestructura invisible.

Un sistema puede ser funcional…
pero si es lento, el usuario lo percibe como roto.

Este protocolo protege la velocidad del sistema.

---

# PRINCIPIO FUNDAMENTAL

EL SISTEMA DEBE SENTIRSE INSTANTÁNEO.

Objetivo mental:

👉 Cada acción debe parecer inmediata.

No importa si tarda 300ms o 900ms…

Debe sentirse rápida.

---

# 🚨 REGLA #1 — NUNCA CARGAR MÁS DATOS DE LOS NECESARIOS

Error clásico:

Traer colecciones completas.

PROHIBIDO:

- descargar miles de registros
- cargar históricos sin filtro
- listeners innecesarios

SIEMPRE usar:

✔ limit()  
✔ filtros  
✔ paginación  
✔ queries indexadas  

Regla simple:

"Cargar solo lo que el usuario puede ver."

---

# 🚨 REGLA #2 — EVITAR RE-RENDERS MASIVOS

Causa principal de apps lentas en React:

Re-renderizar toda la pantalla.

Evitar:

- estados globales innecesarios  
- props gigantes  
- hooks monolíticos  
- context sobrecargados  

Preferir:

✔ componentes pequeños  
✔ memoización cuando sea necesario  
✔ separación de responsabilidades  

---

# 🚨 REGLA #3 — DIVIDIR HOOKS GRANDES

Hooks enormes = renders costosos.

Ejemplo peligroso:

useFinance manejando demasiadas cosas.

Cuando un hook crezca demasiado:

DIVIDIR.

Más pequeño = más rápido.

---

# 🚨 REGLA #4 — LA UI NO DEBE HACER CÁLCULOS PESADOS

PROHIBIDO dentro de componentes:

- agregaciones grandes  
- formateos complejos  
- cálculos financieros extensos  

Mover a:

✔ helpers  
✔ servicios  
✔ hooks  

La UI solo muestra.

No procesa.

---

# 🚨 REGLA #5 — CONTROLAR EL PESO DEL BUNDLE

Apps pesadas = cargas lentas.

Buenas prácticas:

✔ lazy loading de módulos grandes  
✔ imports dinámicos cuando aplique  
✔ evitar librerías innecesarias  

Cada dependencia debe justificarse.

---

# 🚨 REGLA #6 — PROTEGER LA VELOCIDAD PERCIBIDA

No basta con ser rápido…

Hay que parecer rápido.

Usar SIEMPRE:

✔ loaders  
✔ skeleton screens  
✔ indicadores de carga  
✔ feedback inmediato  

El usuario nunca debe preguntarse:

"¿Se quedó pegado?"

---

# 🚨 REGLA #7 — OPTIMIZAR FIREBASE DESDE HOY

Firestore puede ser extremadamente rápido…

o extremadamente lento.

Depende de las queries.

EVITAR:

❌ filtros sin índice  
❌ queries compuestas mal diseñadas  
❌ listeners abiertos sin control  

Cada mala query…

es una futura caída de rendimiento.

---

# 🚨 REGLA #8 — EVITAR TABLAS GIGANTES

Las tablas SIEMPRE crecen.

Preparar desde ahora:

✔ paginación  
✔ virtualización (si escala mucho)  
✔ carga progresiva  

Nunca asumir que los datos serán pocos.

---

# 🚨 REGLA #9 — NO BLOQUEAR EL MAIN THREAD

Si algo congela la UI…

el usuario lo siente como un crash.

Evitar loops grandes.

Evitar cálculos síncronos pesados.

Si algo crece demasiado…

moverlo fuera del render.

---

# 🚨 REGLA #10 — MEDIR ANTES DE OPTIMIZAR

No optimizar por intuición.

Optimizar por evidencia.

Preguntar:

👉 ¿Dónde está realmente el cuello de botella?

Puede ser:

- red  
- render  
- base de datos  
- bundle  
- lógica  

Primero detectar.

Luego actuar.

---

# 🚨 REGLA #11 — EVITAR EFECTOS EN CADENA

Un cambio no debe disparar 10 renders.

Cuidar:

- dependencias de useEffect  
- estados derivados  
- watchers innecesarios  

Menos reactividad = más rendimiento.

---

# 🚨 REGLA #12 — CUIDAR LOS REPORTES

PDF y Excel pueden volverse pesados.

Buenas prácticas:

✔ generación eficiente  
✔ evitar duplicidad  
✔ motores reutilizables  

El reporte no debe congelar la app.

---

# 🚨 REGLA #13 — DETECTAR ALERTAS TEMPRANAS

Señales de degradación:

⚠️ pantallas tardan en abrir  
⚠️ filtros lentos  
⚠️ tablas con lag  
⚠️ loaders prolongados  
⚠️ scroll pesado  

Cuando aparezcan…

Actuar rápido.

---

# 🚨 REGLA #14 — EVITAR SOBREOPTIMIZAR

No optimizar todo.

Solo lo que lo necesita.

La sobreoptimización también genera complejidad.

---

# 🚨 REGLA #15 — EL RENDIMIENTO ES UNA DISCIPLINA

No es una tarea puntual.

Se protege todos los días.

Cada feature nueva debe preguntarse:

👉 ¿Esto mantiene el sistema rápido?

Si la respuesta es dudosa…

Replantear.

---

# REGLA MAESTRA

EL USUARIO NUNCA DEBE SENTIR EL PESO DEL SISTEMA.

---

# FILOSOFÍA TENTELCOM

"La mejor performance es la que el usuario jamás nota…  
porque todo simplemente fluye."
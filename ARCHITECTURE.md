# 🧠 SYSTEM ARCHITECTURE — SOURCE OF TRUTH

## STATUS: ENFORCED  
## ARCHITECTURE MODE: SINGLE ROOT

---

## ✅ SOURCE OF TRUTH

La aplicación opera exclusivamente desde la raíz del proyecto.

ENTRYPOINT:

index.html  
→ index.tsx  
→ App.tsx  
→ /modules  
→ /components  
→ /hooks  
→ /utils  

No existe ningún bridge hacia estructuras externas.

---

## 🚫 PROHIBIDO EN ESTE REPOSITORIO

Bajo ninguna circunstancia se permite:

• Reintroducir la carpeta **/src**  
• Duplicar módulos  
• Crear design systems paralelos  
• Copiar hooks o utils  
• Importar desde rutas fuera del ROOT  

Cualquier violación rompe la arquitectura.

---

## ✅ ESTRUCTURA OFICIAL

/modules        → Business modules  
/components    → Design system + UI  
/hooks         → State & logic reuse  
/utils         → Pure helpers  

Regla crítica:

👉 **Si no vive en ROOT, no existe.**

---

## ⚠️ REGLA DE IMPORTS

Siempre usar rutas relativas internas.

Ejemplo correcto:

../../components/ui/ModuleHeader  

Ejemplo peligroso:

/src/components/...

---

## 🧱 PRINCIPIO ARQUITECTÓNICO

SINGLE SOURCE OF TRUTH

El sistema debe tener una sola versión ejecutable de cada componente.

Arquitecturas espejo quedan TERMINANTEMENTE prohibidas.

---

## 🔒 GOVERNANCE RULE

Antes de crear carpetas nuevas preguntarse:

> “¿Esto ya existe en ROOT?”

Si la respuesta es sí → reutilizar.  
NO duplicar.

---

## 🧨 ANTI-REGRESIÓN

Si aparece nuevamente una carpeta `/src`, debe eliminarse inmediatamente antes de cualquier merge.

Sin excepción.

---

## 📊 ARCHITECTURE STATUS

Split-Brain: ELIMINADO  
Ghost Code: ELIMINADO  
Runtime Drift: CONTROLADO  

CONFIDENCE LEVEL: HIGH
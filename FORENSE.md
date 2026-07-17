# INFORME FORENSE: MOTOR DE IMPORTACIÓN DE WHATSAPP (FASE 3A)

## 1. Flujo completo recorrido
1. **Selección del Archivo:** En la interfaz `ImportWizardModal.tsx`, el usuario hace clic en el área de carga y selecciona el archivo (`.txt` o `.zip`). El evento onChange captura el objeto `File`.
2. **Procesamiento del Archivo:** Al pulsar "Siguiente", la función `processFile()` utiliza `file.text()` para obtener el contenido del archivo.
3. **Lectura del Contenido:** Se extrae el nombre del archivo (`chatName`) y se envía el texto completo extraído a la función `parseWhatsAppText(text, chatName)`.
4. **Parser de WhatsApp:** En `whatsappParser.ts`, la función recibe el texto, lo divide por líneas (`/\r?\n/`) y las evalúa dentro de un bucle `for...of`.
5. **Evaluación (Regex):** Para cada línea, se intenta hacer match con las expresiones regulares definidas para Android e iOS (`androidRegex`, `iosRegex`).
6. **Manejo del Resultado:** Si no se detectan coincidencias iniciales para crear un `currentEvent`, ninguna línea es añadida al array `events`.
7. **Retorno al Componente:** La función devuelve un array vacío `[]`.
8. **Renderizado del Error:** `ImportWizardModal` detecta que `events.length === 0` e imprime el error: *"No se detectaron mensajes. El formato podría ser desconocido."*

## 2. Resultado de cada etapa
- **Selección de Archivo:** Éxito. El navegador proporciona el objeto `File`.
- **Procesamiento del archivo:** 
  - **Para TXT:** Éxito parcial (el texto en plano se extrae correctamente y se entrega al parser). 
  - **Para ZIP:** **Falla silenciosamente**. Se extrae el archivo ZIP como una cadena de bytes corrupta codificada a texto. El sistema actualmente NO implementa la librería para descomprimir un ZIP y buscar el TXT en su interior.
- **Lectura del contenido:** Éxito. El archivo pasa a la memoria.
- **Parser de WhatsApp:** **FALLA**. No es capaz de interpretar el formato oficial y descarta todas las líneas.

## 3. Punto exacto donde ocurre la falla
La falla ocurre en `whatsappParser.ts`, exactamente en la evaluación de coincidencia de la línea:
```typescript
let match = line.match(iosRegex);
// ...
if (!match) {
    match = line.match(androidRegex);
}
```
Ninguna línea del archivo de WhatsApp coincide con los patrones definidos, dejando la variable `match` en estado nulo para todas y cada una de las líneas leídas, lo que resulta en el descarte total del contenido.

## 4. Causa raíz del problema
Las expresiones regulares actuales son extremadamente rígidas y están basadas en un estándar estadounidense (US-English) limpio, lo cual es incompatible con las exportaciones reales de WhatsApp (especialmente las configuraciones regionales en Español o Android modernos). Existen 4 causales precisos del porqué las Regex fallan:

1. **Invisibles de Control Direccional (LRM/RLM):** Las exportaciones oficiales de WhatsApp con frecuencia insertan caracteres invisibles Left-to-Right Mark (`\u200E`) antes de los números (ej. `\u200E15/\u200E05...`). El regex exige que el texto inicie estrictamente con un dígito `^(\d{1,2}...`, lo cual hace que aborte el emparejamiento desde el primer carácter.
2. **Formato AM/PM latinoamericano:** El bloque `(?: [APap][Mm])?` solo soporta cadenas como ` AM` o ` PM`. En español, WhatsApp exporta horas como `10:14 a. m.` o `3:30 p.m.` (con puntos y sin espacios o con múltiples espacios), lo cual rompe el patrón.
3. **Espacios de No Separación (NNBSP):** En versiones modernas de WhatsApp Android, el espacio entre la hora y el "a. m." o entre la fecha y el guion, suele ser un carácter especial Unicode (`\u202F` Narrow No-Break Space), que no es reconocido por los limitados detectores de espacios de la Regex.
4. **Carencia de soporte ZIP real:** Para los archivos .zip, se intenta hacer un "parse" al archivo binario utilizando `file.text()` sin usar un motor de descompresión (como JSZip).

## 5. Nivel de impacto
**Alto.** La funcionalidad de importación es inoperable para la inmensa mayoría de las exportaciones oficiales de WhatsApp, especialmente si el usuario maneja el idioma Español en su teléfono o sube el `.zip` directamente, dejándolos varados en el Paso 2 del asistente de importación.

## 6. Riesgo de la corrección
**Bajo.** El parser y el motor de importación (`whatsappParser.ts`) están aislados (desacoplados) en la nueva carpeta `modules/core/imports/`. La Bitácora Operativa sigue funcionando sin problemas, por lo que corregir estas expresiones regulares y manejar el parseo no afectará en absoluto la estabilidad del sistema core.

## 7. Recomendación técnica para la Fase 3B
- **Relajación de Expresiones Regulares:** Modificar las expresiones regulares en `whatsappParser.ts` para tolerar caracteres invisibles (eliminando todos los `\u200E` y `\u200F` antes de hacer el *match*). 
- **Compatibilidad Extensa AM/PM:** Actualizar los detectores de horario para que sean insensibles a caracteres como `a.m.`, `a. m.`, `p.m.`, `p. m.` y espacios duros (`\u202F`).
- **Librería ZIP:** Si el flujo continuará soportando `.zip`, integrar una librería como `jszip` en la Fase 3B. Al procesar el archivo, detectar si el MIME Type o extensión es ZIP, descomprimir en memoria asíncronamente, extraer el archivo `_chat.txt` y pasar únicamente el string de texto descifrado al parser de WhatsApp.

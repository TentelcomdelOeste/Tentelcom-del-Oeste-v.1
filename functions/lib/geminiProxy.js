"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeProductDataProxy = void 0;
const functions = require("firebase-functions");
const genai_1 = require("@google/genai");
const params_1 = require("firebase-functions/params");
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
exports.normalizeProductDataProxy = functions
    .runWith({
    secrets: [geminiApiKey],
})
    .https.onCall(async (data, context) => {
    // Basic auth check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { raw } = data;
    if (!raw) {
        throw new functions.https.HttpsError("invalid-argument", "Missing 'raw' data.");
    }
    const apiKey = geminiApiKey.value();
    const ai = new genai_1.GoogleGenAI({ apiKey });
    const modelName = "gemini-3-flash-preview";
    const prompt = `
      Actúa como un especialista en datos de productos de telecomunicaciones y TI.
      Tu objetivo es normalizar la información de un producto a partir de datos crudos (scraped).

      Instrucciones:
      1. Título: Genera un título limpio, formato: "Marca Modelo - Tipo/Característica Clave". Elimina palabras de venta como "Oferta", "Barato", códigos internos largos.
      2. Descripción: Genera un resumen técnico de 1 párrafo. Elimina HTML, precios, envío, garantías y "nosotros".
      3. Categoría: Sugiere UNA categoría general (ej: "Fibra Óptica", "Networking", "Herramientas", "Seguridad", "Cableado").
      4. Marca: Extrae la marca del fabricante. Si no es clara, usa "Genérico".

      Datos de Entrada:
      - Título Raw: ${raw.titulo_raw}
      - Descripción Raw: ${raw.descripcion_raw}
      - Especificaciones: ${raw.especificaciones_raw}
      - Fuente: ${raw.fuente}
    `;
    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        titulo_normalizado: { type: genai_1.Type.STRING },
                        descripcion_normalizada: { type: genai_1.Type.STRING },
                        categoria_sugerida: { type: genai_1.Type.STRING },
                        marca_sugerida: { type: genai_1.Type.STRING },
                    },
                    required: ["titulo_normalizado", "descripcion_normalizada", "categoria_sugerida", "marca_sugerida"],
                },
            },
        });
        if (response.text) {
            return JSON.parse(response.text);
        }
        throw new Error("La IA no retornó texto válido.");
    }
    catch (error) {
        functions.logger.error("Error en normalización IA proxy:", error);
        throw new functions.https.HttpsError("internal", "Error procesando normalización IA.");
    }
});
//# sourceMappingURL=geminiProxy.js.map
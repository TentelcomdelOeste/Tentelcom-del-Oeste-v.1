import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

let openaiClient: OpenAI | null = null;
let geminiClient: GoogleGenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiClient = new OpenAI({
      apiKey: key,
    });
  }
  return openaiClient;
}

export function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

function isAuthorizedFirebaseStorageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Check host whitelist
    const isGoogleStorageHost =
      host === 'firebasestorage.googleapis.com' ||
      host === 'storage.googleapis.com' ||
      host === 'tentelcom-del-oeste.firebasestorage.app' ||
      host === 'tentelcom-del-oeste.appspot.com' ||
      host.endsWith('.firebasestorage.app');

    if (!isGoogleStorageHost) {
      return false;
    }

    // Must belong to Tentelcom bucket/project
    const isTentelcomBucket =
      host.includes('tentelcom') ||
      pathname.includes('tentelcom');

    return isTentelcomBucket;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/forensic-audit", async (req, res) => {
    try {
      const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.status(401).json({ error: "Token required" });
        return;
      }

      const https = await import('https');
      
      function fetchCollection(colName: string): Promise<any> {
        return new Promise((resolve, reject) => {
          const url = `https://firestore.googleapis.com/v1/projects/tentelcom-del-oeste/databases/(default)/documents/${colName}?pageSize=300`;
          const r = https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
          });
          r.on('error', reject);
        });
      }

      function parseValue(val: any): any {
        if (!val) return null;
        if ('stringValue' in val) return val.stringValue;
        if ('integerValue' in val) return parseInt(val.integerValue, 10);
        if ('doubleValue' in val) return parseFloat(val.doubleValue);
        if ('booleanValue' in val) return val.booleanValue;
        if ('mapValue' in val) {
          const resMap: any = {};
          for (const k in val.mapValue.fields || {}) {
            resMap[k] = parseValue(val.mapValue.fields[k]);
          }
          return resMap;
        }
        if ('arrayValue' in val) {
          return (val.arrayValue.values || []).map(parseValue);
        }
        return null;
      }

      function parseFields(docFields: any): any {
        const resObj: any = {};
        for (const k in docFields || {}) {
          resObj[k] = parseValue(docFields[k]);
        }
        return resObj;
      }

      const reportsData = await fetchCollection('material_reports');
      if (!reportsData.documents) {
        res.status(500).json({ error: "Failed to fetch material_reports", details: reportsData });
        return;
      }

      const parsedReports = reportsData.documents.map((d: any) => ({
        id: d.name.split('/').pop(),
        path: d.name,
        ...parseFields(d.fields)
      }));

      const targetReport = parsedReports.find((r: any) => {
        const items = r.items || [];
        return items.some((it: any) => {
          const qty = it.quantityRequested || it.quantity;
          return qty === 17 || qty === 54 || qty === 74 || qty === 22;
        });
      });

      if (!targetReport) {
        res.json({ error: "Target report not found", totalReportsScanned: parsedReports.length, recentReports: parsedReports.slice(0, 10) });
        return;
      }

      const inventoryItemsData = await fetchCollection('inventory_items');
      const parsedInventory = (inventoryItemsData.documents || []).map((d: any) => ({
        id: d.name.split('/').pop(),
        ...parseFields(d.fields)
      }));

      const itemAnalysis = (targetReport.items || []).map((item: any) => {
        const invByDocId = parsedInventory.find((inv: any) => inv.id === item.inventoryItemId || inv.id === item.id);
        const invByCode = parsedInventory.find((inv: any) => inv.code === item.code || inv.id === item.code);

        return {
          itemInReport: item,
          inventoryMatchedById: invByDocId ? {
            id: invByDocId.id,
            code: invByDocId.code,
            description: invByDocId.description || invByDocId.name,
            stock: invByDocId.stock ?? 0,
            reserved: invByDocId.reserved ?? 0,
            availableCalculated: (invByDocId.stock ?? 0) - (invByDocId.reserved ?? 0)
          } : null,
          inventoryMatchedByCode: invByCode ? {
            id: invByCode.id,
            code: invByCode.code,
            description: invByCode.description || invByCode.name,
            stock: invByCode.stock ?? 0,
            reserved: invByCode.reserved ?? 0,
            availableCalculated: (invByCode.stock ?? 0) - (invByCode.reserved ?? 0)
          } : null
        };
      });

      const fullResult = {
        targetReport: {
          id: targetReport.id,
          requestNumber: targetReport.requestNumber,
          status: targetReport.status,
          fecha: targetReport.fecha || targetReport.createdAt,
          solicitante: targetReport.requestedBy || targetReport.createdByName || targetReport.solicitante,
          proyecto: targetReport.proyecto || targetReport.projectName || targetReport.workOrderNumber,
          items: targetReport.items
        },
        itemAnalysis,
        allInventoryItemsSummary: parsedInventory.map((inv: any) => ({
          id: inv.id,
          code: inv.code,
          description: inv.description || inv.name,
          stock: inv.stock,
          reserved: inv.reserved
        }))
      };

      const fs = await import('fs');
      fs.writeFileSync('./FORENSIC_RESULT.json', JSON.stringify(fullResult, null, 2));

      res.json({ success: true, result: fullResult });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // Proxy endpoint to download original files cleanly bypassing cross-origin restrictions
  app.get("/api/download-proxy", async (req, res) => {
    try {
      const fileUrl = req.query.url as string;
      const requestedName = (req.query.filename as string) || "imagen_original.jpg";

      if (!fileUrl) {
        res.status(400).json({ error: "URL is required" });
        return;
      }

      if (fileUrl.startsWith("data:")) {
        const matches = fileUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader("Content-Type", mimeType);
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(requestedName)}"`
          );
          res.send(buffer);
          return;
        }
      }

      // Security check: Validate URL against Tentelcom Firebase Storage bucket whitelist
      if (!isAuthorizedFirebaseStorageUrl(fileUrl)) {
        console.warn(`[download-proxy] URL no autorizada rechazada: ${fileUrl}`);
        res.status(403).json({
          error: "URL no autorizada. Solo se permiten descargas desde el almacenamiento oficial de Tentelcom."
        });
        return;
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        res.status(response.status).json({ error: `Failed to fetch file: ${response.statusText}` });
        return;
      }

      const rawContentType = (response.headers.get("content-type") || "").toLowerCase();
      if (
        rawContentType.startsWith("text/") ||
        rawContentType.includes("html") ||
        rawContentType.includes("json")
      ) {
        res.status(502).json({ error: "La respuesta del almacenamiento no contiene una imagen válida." });
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        res.status(502).json({ error: "El archivo descargado está vacío." });
        return;
      }

      let finalContentType = rawContentType || "image/jpeg";
      if (!finalContentType.startsWith("image/")) {
        finalContentType = "image/jpeg";
      }

      res.setHeader("Content-Type", finalContentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(requestedName)}"`
      );
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(buffer);
    } catch (error: any) {
      console.error("Error in download-proxy:", error);
      res.status(500).json({ error: error?.message || "Error proxying download" });
    }
  });

  app.post("/api/openai", async (req, res) => {
    try {
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        messages: req.body.messages || [{ role: "user", content: "Hello" }],
        model: "gpt-4o",
      });
      res.json(completion);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini", async (req, res) => {
    try {
      const gemini = getGemini();
      const response = await gemini.models.generateContent({
        model: req.body.model || 'gemini-2.5-flash',
        contents: req.body.prompt || req.body.contents || 'Hello',
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import { Capacitor } from '@capacitor/core';
import { triggerFileDownload } from '../../../utils/fileUtils';

export function isImageFile(name?: string, url?: string): boolean {
  if (!name && !url) return false;

  const nameClean = (typeof name === 'string' ? name : "").trim().toLowerCase();
  const urlClean = (typeof url === 'string' ? url : "").trim().toLowerCase();

  if (urlClean.startsWith("blob:")) return true;
  if (urlClean.startsWith("data:image/")) return true;

  const imgExts = /\.(png|jpe?g|gif|webp|svg|heic|heif)\b/i;
  if (nameClean && imgExts.test(nameClean)) return true;

  if (urlClean) {
    const rxUrl = /\.(png|jpe?g|gif|webp|svg|heic|heif)(\?|\b|$)/i;
    if (rxUrl.test(urlClean)) return true;

    if (
      urlClean.includes("images%2f") ||
      urlClean.includes("/images/") ||
      urlClean.includes("image_") ||
      urlClean.includes("photo_") ||
      urlClean.includes("camera_")
    ) {
      return true;
    }
  }

  return false;
}

export async function forceDownloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();
    await triggerFileDownload(blob, fileName || "archivo");
  } catch (err) {
    console.error("forceDownloadFile error:", err);
    if (Capacitor.isNativePlatform()) {
        throw new Error(`No se pudo descargar el archivo de forma segura. Detalles: ${err}`);
    } else {
        // En entorno web, usar a.click() para el URL directo como último recurso
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName || "archivo";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  }
}

function parseDate(ts: any): Date {
  if (!ts) return new Date(0);
  
  let d: Date;
  if (ts.toDate && typeof ts.toDate === 'function') {
    d = ts.toDate();
  } else if (ts instanceof Date) {
    d = ts;
  } else if (typeof ts === 'number' || typeof ts === 'string') {
    d = new Date(ts);
  } else if (ts.seconds !== undefined) {
    d = new Date(ts.seconds * 1000);
  } else {
    d = new Date(0);
  }

  return isNaN(d.getTime()) ? new Date(0) : d;
}

export const formatTime = (ts: any): string => {
  const d = parseDate(ts);
  try {
    return new Intl.DateTimeFormat("es-CR", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }).format(d);
  } catch (e) {
    console.error("formatTime error:", e, ts);
    return "Hora inválida";
  }
};

export const getFormattedDate = (ts: any): string => {
  const d = parseDate(ts);
  if (d.getTime() === 0) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  try {
    if (d.toDateString() === today.toDateString()) return "HOY";
    if (d.toDateString() === yesterday.toDateString()) return "AYER";
    return new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch (e) {
    console.error("getFormattedDate error:", e, ts);
    return "Fecha inválida";
  }
};

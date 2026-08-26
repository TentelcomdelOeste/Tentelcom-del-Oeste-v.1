"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncVehiclePhotoToOneDrive = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const storage_1 = require("firebase-functions/v2/storage");
const params_1 = require("firebase-functions/params");
const secret_manager_1 = require("@google-cloud/secret-manager");
const onedriveClientId = (0, params_1.defineSecret)("ONEDRIVE_CLIENT_ID");
const onedriveRefreshToken = (0, params_1.defineSecret)("ONEDRIVE_REFRESH_TOKEN");
// Carpeta compartida "UNIDADES DE TRANSPORTE" (cuenta distinta a la autenticada,
// compartida con el usuario de la app). Resuelto vía /me/drive/sharedWithMe.
const SHARED_DRIVE_ID = "451f019285d318ef";
const SHARED_FOLDER_ITEM_ID = "451F019285D318EF!sa1c0bdf02d4546d28609a3ad961ce0b6";
const MESES_ES = [
    "01-Enero", "02-Febrero", "03-Marzo", "04-Abril", "05-Mayo", "06-Junio",
    "07-Julio", "08-Agosto", "09-Septiembre", "10-Octubre", "11-Noviembre", "12-Diciembre",
];
const secretManagerClient = new secret_manager_1.SecretManagerServiceClient();
let cachedAccessToken = null;
let tokenExpiresAt = 0;
let currentRefreshToken = null;
/**
 * Persiste una nueva versión del secreto ONEDRIVE_REFRESH_TOKEN en Google Secret Manager.
 * No imprime ni registra nunca el valor del token.
 */
async function persistRefreshToken(newRefreshToken) {
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT ||
            process.env.GCLOUD_PROJECT ||
            process.env.GCP_PROJECT ||
            admin.app().options.projectId ||
            (await secretManagerClient.getProjectId().catch(() => null));
        if (!projectId) {
            functions.logger.warn("Could not determine GCP project ID to persist rotated ONEDRIVE_REFRESH_TOKEN to Secret Manager.");
            return;
        }
        const parent = `projects/${projectId}/secrets/ONEDRIVE_REFRESH_TOKEN`;
        await secretManagerClient.addSecretVersion({
            parent,
            payload: {
                data: Buffer.from(newRefreshToken, "utf8"),
            },
        });
        functions.logger.info("Successfully created new version for ONEDRIVE_REFRESH_TOKEN in Secret Manager.");
    }
    catch (err) {
        functions.logger.error("Failed to persist rotated ONEDRIVE_REFRESH_TOKEN to Secret Manager:", err.message || err);
    }
}
/**
 * Obtiene el Access Token de OneDrive usando el flujo OAuth delegado con refresh_token
 * sin client_secret (Public Client / Personal Microsoft Account).
 */
async function getOneDriveAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && now < tokenExpiresAt - 300000) {
        return cachedAccessToken;
    }
    const clientId = onedriveClientId.value();
    const refreshToken = currentRefreshToken || onedriveRefreshToken.value();
    const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("refresh_token", refreshToken);
    params.append("grant_type", "refresh_token");
    params.append("scope", "offline_access Files.ReadWrite User.Read");
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to obtain OneDrive access token: ${response.status} ${errText}`);
    }
    const data = (await response.json());
    cachedAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    tokenExpiresAt = now + expiresIn * 1000;
    if (data.refresh_token && data.refresh_token !== refreshToken) {
        currentRefreshToken = data.refresh_token;
        await persistRefreshToken(data.refresh_token);
    }
    return cachedAccessToken;
}
exports.syncVehiclePhotoToOneDrive = (0, storage_1.onObjectFinalized)({
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 300,
    secrets: [onedriveClientId, onedriveRefreshToken],
}, async (event) => {
    const object = event.data;
    if (!object) {
        return;
    }
    const filePath = object.name;
    if (!filePath || !filePath.startsWith("vehicle_photos/")) {
        return;
    }
    const pathParts = filePath.split("/");
    if (pathParts.length < 3) {
        return;
    }
    const unidadId = pathParts[1];
    const fileName = pathParts[2];
    const db = admin.firestore();
    const bucketName = object.bucket || event.bucket;
    const bucket = admin.storage().bucket(bucketName);
    let attempts = 0;
    const maxRetries = 3;
    let success = false;
    let lastError = null;
    let webUrl = "";
    let nombreUnidad = unidadId;
    // 1. Preferir el nombre completo de la unidad tal como se ve en el sistema
    // (ej. "U1 - NISSAN PATHFINDER - 532995"), enviado como metadato al subir la foto.
    const metadataUnidadCompleta = object.metadata?.unidadCompleta;
    if (metadataUnidadCompleta) {
        nombreUnidad = metadataUnidadCompleta;
    }
    else {
        // 2. Fallback: resolver contra la colección 'vehiculos' (puede estar desactualizada).
        try {
            const vehDoc = await db.collection("vehiculos").doc(unidadId).get();
            let vData = vehDoc.exists ? vehDoc.data() : undefined;
            if (!vData) {
                const qVeh = await db
                    .collection("vehiculos")
                    .where("unidad", "==", unidadId)
                    .limit(1)
                    .get();
                if (!qVeh.empty) {
                    vData = qVeh.docs[0].data();
                }
            }
            if (vData) {
                const uCode = vData.unidad || unidadId;
                const uModelo = vData.modelo || "";
                const uPlaca = vData.placa || "";
                nombreUnidad = [uCode, uModelo, uPlaca].filter(Boolean).join(" - ");
            }
        }
        catch (e) {
            functions.logger.warn(`Could not resolve unit name for ${unidadId}, using ID:`, e);
        }
    }
    nombreUnidad = nombreUnidad.replace(/[/\\?%*:|"<>]/g, "-");
    // Subcarpeta por año-mes (ej. "2026-08-Agosto"), basada en la fecha de subida del archivo.
    const uploadDate = object.timeCreated ? new Date(object.timeCreated) : new Date();
    const anioMes = `${uploadDate.getFullYear()}-${MESES_ES[uploadDate.getMonth()]}`;
    let fileBuffer;
    try {
        const [buffer] = await bucket.file(filePath).download();
        fileBuffer = buffer;
    }
    catch (err) {
        functions.logger.error(`Error downloading file ${filePath} from storage:`, err);
        return;
    }
    const graphEndpoint = `https://graph.microsoft.com/v1.0/drives/${SHARED_DRIVE_ID}/items/${SHARED_FOLDER_ITEM_ID}:/${encodeURIComponent(nombreUnidad)}/${encodeURIComponent(anioMes)}/${encodeURIComponent(fileName)}:/content`;
    while (attempts < maxRetries && !success) {
        attempts++;
        try {
            const token = await getOneDriveAccessToken();
            const response = await fetch(graphEndpoint, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "image/jpeg",
                },
                body: new Uint8Array(fileBuffer),
            });
            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Graph API error (${response.status}): ${errBody}`);
            }
            const resJson = (await response.json());
            webUrl = resJson.webUrl || "";
            success = true;
        }
        catch (err) {
            lastError = err;
            functions.logger.warn(`OneDrive sync attempt ${attempts} failed for ${filePath}:`, err.message || err);
            if (attempts < maxRetries) {
                await new Promise((res) => setTimeout(res, attempts * 2000));
            }
        }
    }
    if (success) {
        functions.logger.info(`Successfully synced ${filePath} to OneDrive (${nombreUnidad}/${fileName})`);
        try {
            const nowIso = new Date().toISOString();
            const logsQuery = await db
                .collection("bitacora_vehiculos")
                .where("unidad", "==", unidadId)
                .orderBy("fecha", "desc")
                .limit(1)
                .get();
            if (!logsQuery.empty) {
                const logDocRef = logsQuery.docs[0].ref;
                await logDocRef.update({
                    oneDriveUrl: webUrl,
                    oneDriveSyncedAt: nowIso,
                });
            }
            else {
                const logsQuery2 = await db
                    .collection("bitacora_vehiculos")
                    .where("unidad", "==", nombreUnidad.split(" - ")[0])
                    .orderBy("fecha", "desc")
                    .limit(1)
                    .get();
                if (!logsQuery2.empty) {
                    await logsQuery2.docs[0].ref.update({
                        oneDriveUrl: webUrl,
                        oneDriveSyncedAt: nowIso,
                    });
                }
            }
        }
        catch (dbErr) {
            functions.logger.error("Error updating bitacora_vehiculos with oneDriveUrl:", dbErr);
        }
    }
    else {
        functions.logger.error(`Failed to sync ${filePath} to OneDrive after ${maxRetries} attempts.`);
        try {
            await db.collection("sync_failures").add({
                filePath,
                unidadId,
                nombreUnidad,
                error: lastError?.message || String(lastError),
                attempts,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (failErr) {
            functions.logger.error("Error writing to sync_failures collection:", failErr);
        }
    }
});
//# sourceMappingURL=oneDriveSync.js.map
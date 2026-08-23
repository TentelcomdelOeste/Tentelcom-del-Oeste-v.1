"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncVehiclePhotoToOneDrive = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const params_1 = require("firebase-functions/params");
const onedriveClientId = (0, params_1.defineSecret)("ONEDRIVE_CLIENT_ID");
const onedriveClientSecret = (0, params_1.defineSecret)("ONEDRIVE_CLIENT_SECRET");
const onedriveTenantId = (0, params_1.defineSecret)("ONEDRIVE_TENANT_ID");
let cachedToken = null;
let tokenExpiresAt = 0;
async function getOneDriveAccessToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 300000) {
        return cachedToken;
    }
    const clientId = onedriveClientId.value();
    const clientSecret = onedriveClientSecret.value();
    const tenantId = onedriveTenantId.value();
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("scope", "https://graph.microsoft.com/.default");
    params.append("grant_type", "client_credentials");
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to obtain OneDrive access token: ${response.status} ${errText}`);
    }
    const data = await response.json();
    cachedToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    tokenExpiresAt = now + (expiresIn * 1000);
    return cachedToken;
}
exports.syncVehiclePhotoToOneDrive = functions
    .runWith({
    secrets: [onedriveClientId, onedriveClientSecret, onedriveTenantId],
    timeoutSeconds: 300,
    memory: "512MB",
})
    .storage
    .object()
    .onFinalize(async (object) => {
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
    const bucket = admin.storage().bucket(object.bucket);
    let attempts = 0;
    const maxRetries = 3;
    let success = false;
    let lastError = null;
    let webUrl = "";
    let nombreUnidad = unidadId;
    try {
        const vehDoc = await db.collection("vehiculos").doc(unidadId).get();
        if (vehDoc.exists) {
            const vData = vehDoc.data();
            if (vData) {
                const uCode = vData.unidad || unidadId;
                const uPlaca = vData.placa || "";
                nombreUnidad = uPlaca ? `${uCode} - ${uPlaca}` : uCode;
            }
        }
        else {
            const qVeh = await db.collection("vehiculos").where("unidad", "==", unidadId).limit(1).get();
            if (!qVeh.empty) {
                const vData = qVeh.docs[0].data();
                const uCode = vData.unidad || unidadId;
                const uPlaca = vData.placa || "";
                nombreUnidad = uPlaca ? `${uCode} - ${uPlaca}` : uCode;
            }
        }
    }
    catch (e) {
        functions.logger.warn(`Could not resolve unit name for ${unidadId}, using ID:`, e);
    }
    nombreUnidad = nombreUnidad.replace(/[/\\?%*:|"<>]/g, "-");
    let fileDate = new Date();
    if (object.timeCreated) {
        fileDate = new Date(object.timeCreated);
    }
    else {
        const tsMatch = fileName.match(/^(\d+)/);
        if (tsMatch) {
            const num = parseInt(tsMatch[1], 10);
            if (!isNaN(num)) {
                fileDate = new Date(num > 1e12 ? num : num * 1000);
            }
        }
    }
    const yyyy = fileDate.getFullYear();
    const mm = String(fileDate.getMonth() + 1).padStart(2, "0");
    const dd = String(fileDate.getDate()).padStart(2, "0");
    const hh = String(fileDate.getHours()).padStart(2, "0");
    const min = String(fileDate.getMinutes()).padStart(2, "0");
    const formattedFileName = `${yyyy}-${mm}-${dd}_${hh}${min}.jpg`;
    let fileBuffer;
    try {
        const [buffer] = await bucket.file(filePath).download();
        fileBuffer = buffer;
    }
    catch (err) {
        functions.logger.error(`Error downloading file ${filePath} from storage:`, err);
        return;
    }
    const userId = "a632808b-7d8e-430b-9275-9e9560d830e9";
    const graphEndpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/drive/root:/UNIDADES TENTELCOM/${encodeURIComponent(nombreUnidad)}/${encodeURIComponent(formattedFileName)}:/content`;
    while (attempts < maxRetries && !success) {
        attempts++;
        try {
            const token = await getOneDriveAccessToken();
            const response = await fetch(graphEndpoint, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "image/jpeg",
                },
                body: new Uint8Array(fileBuffer),
            });
            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Graph API error (${response.status}): ${errBody}`);
            }
            const resJson = await response.json();
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
        functions.logger.info(`Successfully synced ${filePath} to OneDrive (${nombreUnidad}/${formattedFileName})`);
        try {
            const nowIso = new Date().toISOString();
            const logsQuery = await db.collection("bitacora_vehiculos")
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
                const logsQuery2 = await db.collection("bitacora_vehiculos")
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
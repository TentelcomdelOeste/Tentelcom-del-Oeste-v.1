"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCriticalActionAudit = exports.weeklyTokenCleanup = exports.onNotificationCreated = exports.sendJobNotification = exports.onTrabajoChange = exports.sendContactEmail = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const params_1 = require("firebase-functions/params");
const tasks_1 = require("@google-cloud/tasks");
// Inicialización de Admin SDK (Singleton pattern)
if (!admin.apps.length) {
    admin.initializeApp();
}
// 1. DEFINICIÓN DE SECRETOS (Seguridad)
const smtpEmail = (0, params_1.defineSecret)("SMTP_EMAIL");
const smtpPassword = (0, params_1.defineSecret)("SMTP_PASSWORD");
/**
 * Utilería para sanitizar strings y evitar inyección HTML/XSS
 */
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== "string")
        return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};
/**
 * Validación básica de formato de email
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.sendContactEmail = functions
    .runWith({
    secrets: [smtpEmail, smtpPassword],
    memory: "256MB",
    timeoutSeconds: 60,
})
    .firestore.document("contact_requests/{docId}")
    .onCreate(async (snap, context) => {
    const docId = context.params.docId;
    const data = snap.data();
    const name = data.name;
    const email = data.email;
    const message = data.message;
    const phone = data.phone;
    const isDataValid = name &&
        name.trim().length > 0 &&
        email &&
        isValidEmail(email) &&
        message &&
        message.trim().length > 0;
    if (!isDataValid) {
        functions.logger.warn(`Datos inválidos en solicitud de contacto [${docId}]`, {
            data: { name, email, hasMessage: !!message },
        });
        await snap.ref.update({
            status: "invalid_data",
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            error: "Campos obligatorios faltantes o formato de email incorrecto.",
        });
        return;
    }
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = phone ? escapeHtml(phone) : "N/A";
    const safeMessage = escapeHtml(message);
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: smtpEmail.value(),
            pass: smtpPassword.value(),
        },
    });
    const mailOptions = {
        from: `"Web Contact Form" <${smtpEmail.value()}>`,
        replyTo: safeEmail,
        to: "admin@tentelcom.com",
        subject: `Nuevo contacto web: ${safeName}`,
        text: `Nombre: ${safeName}\nEmail: ${safeEmail}\nTeléfono: ${safePhone}\n\nMensaje:\n${safeMessage}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
          <h2 style="color: #1e3a8a;">Nueva Solicitud de Contacto</h2>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p><strong>Nombre:</strong> ${safeName}</p>
          <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
          <p><strong>Teléfono:</strong> ${safePhone}</p>
          <br/>
          <p><strong>Mensaje:</strong></p>
          <div style="background-color: #f9fafb; padding: 15px; border-left: 4px solid #1e3a8a; border-radius: 4px;">
            ${safeMessage.replace(/\n/g, "<br/>")}
          </div>
          <br/>
          <small style="color: #888;">ID Referencia: ${docId}</small>
        </div>
      `,
    };
    try {
        await transporter.sendMail(mailOptions);
        functions.logger.info(`Correo enviado exitosamente para [${docId}]`);
        await snap.ref.update({
            status: "email_sent",
            emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        functions.logger.error(`Error SMTP enviando correo para [${docId}]`, {
            error: error.message || error,
        });
        await snap.ref.update({
            status: "email_failed",
            error: error.message || "Error desconocido en el servidor de correo",
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
__exportStar(require("./geminiProxy"), exports);
__exportStar(require("./oneDriveSync"), exports);
const tasksClient = new tasks_1.CloudTasksClient();
/**
 * Función para programar una tarea en Cloud Tasks
 */
const scheduleTask = async (trabajoId, notificationType, scheduledTime) => {
    const project = admin.instanceId().app.options.projectId;
    const location = "us-central1"; // Cambiar según la ubicación de tu proyecto
    const queue = "job-notifications";
    const url = `https://${location}-${project}.cloudfunctions.net/sendJobNotification`;
    const payload = { trabajoId, notificationType };
    const parent = tasksClient.queuePath(project, location, queue);
    const taskName = `projects/${project}/locations/${location}/queues/${queue}/tasks/reminder-${trabajoId}-${notificationType}-${scheduledTime.seconds}`;
    const task = {
        name: taskName,
        httpRequest: {
            httpMethod: "POST",
            url,
            body: Buffer.from(JSON.stringify(payload)).toString("base64"),
            headers: {
                "Content-Type": "application/json",
            },
        },
        scheduleTime: {
            seconds: scheduledTime.seconds,
        },
    };
    try {
        const [response] = await tasksClient.createTask({ parent, task });
        return response.name;
    }
    catch (error) {
        if (error.code === 6 || error.message?.includes("ALREADY_EXISTS")) {
            functions.logger.info(`Tarea duplicada ignorada para trabajo ${trabajoId} (${notificationType})`);
            return taskName;
        }
        throw error;
    }
};
/**
 * Trigger para programar notificaciones cuando se crea o actualiza un trabajo
 */
exports.onTrabajoChange = functions.firestore
    .document("trabajos/{trabajoId}")
    .onWrite(async (change, context) => {
    const trabajoId = context.params.trabajoId;
    const data = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;
    // Si el trabajo fue eliminado, podríamos querer cancelar tareas, 
    // pero Cloud Tasks no permite cancelar fácilmente por ID de trabajo sin guardar el task ID.
    // En su lugar, la función HTTP verificará si el trabajo aún existe y si la fecha es la misma.
    if (!data)
        return;
    // Si la fecha de inicio no ha cambiado, no reprogramamos
    if (oldData && oldData.fecha_inicio.toMillis() === data.fecha_inicio.toMillis()) {
        return;
    }
    const fechaInicio = data.fecha_inicio;
    const now = Date.now();
    // Tiempos de notificación (en milisegundos)
    const times = [
        { type: "24h", offset: 24 * 60 * 60 * 1000 },
        { type: "2h", offset: 2 * 60 * 60 * 1000 },
        { type: "30min", offset: 30 * 60 * 1000 },
    ];
    const taskPromises = times.map(async (t) => {
        const scheduledMillis = fechaInicio.toMillis() - t.offset;
        if (scheduledMillis > now) {
            const scheduledTime = admin.firestore.Timestamp.fromMillis(scheduledMillis);
            try {
                await scheduleTask(trabajoId, t.type, scheduledTime);
                functions.logger.info(`Tarea ${t.type} programada para trabajo ${trabajoId}`);
            }
            catch (error) {
                functions.logger.error(`Error programando tarea ${t.type} para trabajo ${trabajoId}`, error);
            }
        }
    });
    await Promise.all(taskPromises);
});
/**
 * Función HTTP que recibe las tareas de Cloud Tasks y envía las notificaciones FCM
 */
exports.sendJobNotification = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    const { trabajoId, notificationType } = req.body;
    try {
        const trabajoSnap = await admin.firestore().collection("trabajos").doc(trabajoId).get();
        if (!trabajoSnap.exists) {
            functions.logger.warn(`Trabajo ${trabajoId} no encontrado. Abortando notificación.`);
            res.status(200).send("Trabajo no encontrado");
            return;
        }
        const trabajo = trabajoSnap.data();
        const { tipo_trabajo, ubicacion, cuadrilla, fecha_inicio } = trabajo;
        // Verificar si la fecha de inicio sigue siendo la misma (para evitar notificaciones obsoletas)
        // Cloud Tasks no se cancelan fácilmente, así que validamos aquí.
        const now = Date.now();
        const fechaInicioMillis = fecha_inicio.toMillis();
        // Tolerancia de 5 minutos para la ejecución de la tarea
        const diff = Math.abs(now - (fechaInicioMillis - getOffset(notificationType)));
        if (diff > 5 * 60 * 1000) {
            functions.logger.info(`Notificación ${notificationType} para ${trabajoId} obsoleta o reprogramada. Abortando.`);
            res.status(200).send("Notificación obsoleta");
            return;
        }
        if (!cuadrilla || !Array.isArray(cuadrilla) || cuadrilla.length === 0) {
            res.status(200).send("Sin cuadrilla asignada");
            return;
        }
        // Obtener tokens de todos los usuarios de la cuadrilla
        const allTokenStrings = [];
        const userPromises = cuadrilla.map(async (userId) => {
            const userSnap = await admin.firestore().collection("employees").doc(userId).get();
            if (userSnap.exists) {
                const userData = userSnap.data();
                if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                    const extracted = userData.fcmTokens.map((t) => typeof t === "string" ? t : t.token);
                    allTokenStrings.push(...extracted);
                }
            }
        });
        await Promise.all(userPromises);
        if (allTokenStrings.length === 0) {
            res.status(200).send("Sin tokens registrados");
            return;
        }
        // Formatear mensaje según el tipo
        let body = "";
        switch (notificationType) {
            case "24h":
                body = `Mañana tienes un trabajo: ${tipo_trabajo} en ${ubicacion}`;
                break;
            case "2h":
                body = `En 2 horas inicia: ${tipo_trabajo}`;
                break;
            case "30min":
                body = `En 30 minutos inicia: ${tipo_trabajo}`;
                break;
        }
        const message = {
            tokens: allTokenStrings,
            data: {
                trabajoId,
                type: "scheduled_job",
                title: "Trabajo programado",
                body,
                url: `/bitacora/${trabajoId}`,
            },
            android: {
                priority: "high",
                ttl: 86400000,
            },
            webpush: {
                headers: {
                    Urgency: "high",
                    TTL: "86400",
                },
                data: {
                    trabajoId,
                    type: "scheduled_job",
                    title: "Trabajo programado",
                    body,
                    url: `/bitacora/${trabajoId}`,
                },
                fcmOptions: {
                    link: `/bitacora/${trabajoId}`,
                },
            },
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        // Limpiar tokens fallidos
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(allTokenStrings[idx]);
                }
            });
            functions.logger.info(`Limpiando ${failedTokens.length} tokens fallidos para trabajo ${trabajoId}`);
            // Lógica de limpieza integrada
            for (const userId of cuadrilla) {
                await cleanupUserTokens(userId, failedTokens);
            }
        }
        res.status(200).send("Notificaciones enviadas");
    }
    catch (error) {
        functions.logger.error("Error enviando notificación de trabajo", error);
        res.status(500).send("Internal Server Error");
    }
});
/**
 * Trigger para enviar notificaciones FCM cuando se crea una notificación en Firestore
 */
exports.onNotificationCreated = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data)
        return;
    const { targetUserId, type, triggeredByName, trabajoTitle, comentarioTexto, trabajoId, comentarioId } = data;
    if (!targetUserId)
        return;
    try {
        const userSnap = await admin.firestore().collection("employees").doc(targetUserId).get();
        if (!userSnap.exists)
            return;
        const userData = userSnap.data();
        const rawTokens = userData.fcmTokens || [];
        const tokenStrings = rawTokens.map(t => typeof t === "string" ? t : t.token);
        if (tokenStrings.length === 0)
            return;
        let title = "Nueva notificación";
        let body = "";
        switch (type) {
            case "mention":
                title = "Mención en Bitácora";
                body = `${triggeredByName} te mencionó en: ${trabajoTitle || "un trabajo"}`;
                break;
            case "reply":
                title = "Nueva respuesta";
                body = `${triggeredByName} respondió a tu comentario en: ${trabajoTitle || "un trabajo"}`;
                break;
            case "comment":
                title = "Nuevo comentario";
                body = `${triggeredByName} comentó en: ${trabajoTitle || "un trabajo"}`;
                break;
            case "assignment":
                title = "Asignación de trabajo";
                body = `Has sido asignado a: ${trabajoTitle || "un nuevo trabajo"}`;
                break;
            default:
                body = `${triggeredByName} realizó una acción en ${trabajoTitle || "un trabajo"}`;
        }
        if (comentarioTexto) {
            body += `\n"${comentarioTexto.substring(0, 50)}${comentarioTexto.length > 50 ? "..." : ""}"`;
        }
        const message = {
            tokens: tokenStrings,
            // ── Data puro — el SW construye la notificación ──
            data: {
                trabajoId: trabajoId || "",
                comentarioId: comentarioId || "",
                notificationId: context.params.notificationId,
                type: type || "default",
                title: title,
                body: body,
            },
            // ── Android — alta prioridad + canal explícito ────
            android: {
                priority: "high",
                ttl: 86400000,
            },
            // ── Web Push — Chrome Android y Desktop ───────────
            webpush: {
                headers: {
                    Urgency: "high",
                    TTL: "86400",
                },
                // SIN bloque `notification` aquí.
                // Al omitirlo, Chrome siempre delega al SW via onBackgroundMessage.
                // El SW construye la notificación con todas las opciones custom.
                data: {
                    trabajoId: trabajoId || "",
                    comentarioId: comentarioId || "",
                    notificationId: context.params.notificationId,
                    type: type || "default",
                    title: title,
                    body: body,
                    url: trabajoId ? `/bitacora/${trabajoId}` : "/",
                },
                fcmOptions: {
                    link: trabajoId ? `/bitacora/${trabajoId}` : "/",
                },
            },
            // ── APNs (iOS) ────────────────────────────────────
            apns: {
                headers: {
                    "apns-priority": "10",
                    "apns-push-type": "alert",
                },
                payload: {
                    aps: {
                        alert: { title, body },
                        sound: "default",
                        badge: 1,
                        contentAvailable: true,
                    },
                },
            },
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokenStrings[idx]);
                }
            });
            await cleanupUserTokens(targetUserId, failedTokens);
        }
        functions.logger.info(`Notificación push enviada a ${targetUserId} para ${type}`);
    }
    catch (error) {
        functions.logger.error(`Error procesando push para notificación ${context.params.notificationId}`, error);
    }
});
/**
 * Función interna para limpiar tokens inválidos del perfil de un empleado
 */
async function cleanupUserTokens(userId, tokensToRemove) {
    if (tokensToRemove.length === 0)
        return;
    try {
        const userRef = admin.firestore().collection("employees").doc(userId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            const currentTokens = userSnap.data()?.fcmTokens || [];
            // Filtramos los tokens que coincidan con la cadena (ya sea el string directo o la propiedad .token)
            const updatedTokens = currentTokens.filter(t => {
                const tokenStr = typeof t === "string" ? t : t.token;
                return !tokensToRemove.includes(tokenStr);
            });
            if (currentTokens.length !== updatedTokens.length) {
                await userRef.update({ fcmTokens: updatedTokens });
                functions.logger.info(`Tokens actualizados para usuario ${userId}. Eliminados: ${currentTokens.length - updatedTokens.length}`);
            }
        }
    }
    catch (error) {
        functions.logger.error(`Error limpiando tokens del usuario ${userId}`, error);
    }
}
/**
 * Función periódica para limpieza proactiva de tokens (Deduplicación y control de volumen)
 */
exports.weeklyTokenCleanup = functions.pubsub
    .schedule("every 7 days")
    .onRun(async () => {
    const usersSnap = await admin.firestore().collection("employees").get();
    const batch = admin.firestore().batch();
    let totalUpdated = 0;
    usersSnap.docs.forEach((doc) => {
        const tokens = doc.data().fcmTokens || [];
        if (tokens.length > 10) {
            // Mantener solo los 10 más recientes
            const recentTokens = tokens.slice(-10);
            batch.update(doc.ref, { fcmTokens: recentTokens });
            totalUpdated++;
        }
    });
    if (totalUpdated > 0) {
        await batch.commit();
        functions.logger.info(`Limpieza semanal completada. Usuarios actualizados: ${totalUpdated}`);
    }
    return null;
});
function getOffset(type) {
    switch (type) {
        case "24h": return 24 * 60 * 60 * 1000;
        case "2h": return 2 * 60 * 60 * 1000;
        case "30min": return 30 * 60 * 1000;
        default: return 0;
    }
}
exports.onCriticalActionAudit = functions.firestore
    .document('{collection}/{docId}')
    .onWrite(async (change, context) => {
    const AUDITED_COLLECTIONS = [
        'trabajos',
        'cashflow_entries',
        'quotes'
    ];
    const { collection, docId } = context.params;
    if (!AUDITED_COLLECTIONS.includes(collection))
        return null;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const actionType = !before && after ? 'CREATE' :
        before && !after ? 'DELETE' :
            'UPDATE';
    if (actionType === 'UPDATE') {
        let CRITICAL_FIELDS = [];
        if (collection === 'trabajos') {
            CRITICAL_FIELDS = ['estado', 'fecha_inicio', 'fecha_fin', 'cuadrilla', 'eliminado'];
        }
        else if (collection === 'cashflow_entries') {
            CRITICAL_FIELDS = ['amount', 'type', 'category', 'date', 'bankAccountId', 'deleted'];
        }
        else if (collection === 'quotes') {
            CRITICAL_FIELDS = ['status', 'total', 'clientId', 'deleted'];
        }
        const changedFields = Object.keys(after || {}).filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
        const hasCriticalChange = changedFields.some(f => CRITICAL_FIELDS.includes(f));
        if (!hasCriticalChange)
            return null;
    }
    const auditEntry = {
        collection,
        docId,
        actionType,
        before: actionType === 'DELETE' ? before : null,
        after: actionType === 'CREATE' ? after : null,
        delta: actionType === 'UPDATE'
            ? Object.fromEntries(Object.keys(after || {})
                .filter(k => JSON.stringify(before?.[k]) !==
                JSON.stringify(after?.[k]))
                .map(k => ([k, { from: before?.[k], to: after?.[k] }])))
            : null,
        triggeredBy: after?.updatedBy || before?.updatedBy || 'system',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    await admin.firestore()
        .collection('audit_log')
        .add(auditEntry);
    return null;
});
//# sourceMappingURL=index.js.map
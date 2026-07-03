import Alert from './alerts.model.js';
import Student from '../students/student.model.js';
import Coordinator from '../coordinator/coordinator.model.js';
import { generateUniformEmail, sendSmartEmail } from '../../utils/email-generator.js';
import { io } from '../../configs/app.js';
import { createNotification } from '../notifications/notification.controller.js';
import { getPreferencesForUser } from '../preferences/preference.controller.js';

// Quita el prefijo `data:image/jpeg;base64,` o `data:image/png;base64,`
// para que nodemailer (con encoding: 'base64') reciba el base64 puro.
// Si la entrada no es data URL, la retorna tal cual (puede ser ya
// base64 puro o un Buffer).
const stripDataUrlPrefix = (input) => {
    if (!input || typeof input !== 'string') return input;
    const m = input.match(/^data:[a-zA-Z0-9/+.-]+;base64,(.+)$/);
    return m ? m[1] : input;
};

// Decodifica un data URL `data:image/jpeg;base64,XXX` a Buffer. Si la
// entrada ya es Buffer o no es data URL, retorna null.
const dataUrlToBuffer = (input) => {
    if (!input || typeof input !== 'string') return null;
    const m = input.match(/^data:[a-zA-Z0-9/+.-]+;base64,(.+)$/);
    if (!m) return null;
    return Buffer.from(m[1], 'base64');
};

// Decora las imagenes de evidencia de un alert con bboxes/labels
// embebidos via el endpoint /api/annotate de pyimage. Retorna una lista
// de strings base64 (puro, sin prefijo data:) listos para nodemailer.
//
// Si pyimage falla, retorna los originales (sin anotar) para que el
// email no se pierda. La idea es que un fallo de anotacion NUNCA
// bloquee el envio de la alerta.
const annotateAlertImages = async (imageBase64List, alertMeta) => {
    if (!Array.isArray(imageBase64List) || imageBase64List.length === 0) {
        return imageBase64List;
    }
    const { pyimageClient } = await import('../../utils/pyimage-client.js');
    // Construir el "student" en el shape que draw_bboxes espera:
    // { identity, hasUniform, hasAccessory, clothingBoxes, faceBox, ... }
    const studentForAnnotation = {
        identity: [alertMeta.studentName, alertMeta.studentSurname].filter(Boolean).join(' ') || null,
        student_id: null,
        isUnknown: false,
        hasUniform: alertMeta.reason === 'UNIFORME_INCOMPLETO' ? false : null,
        hasAccessory: alertMeta.reason === 'ACCESORIO_NO_PERMITIDO' ? true : null,
        faceBox: alertMeta.faceBox || null,
        clothingBoxes: alertMeta.clothingBoxes || [],
        videoSize: alertMeta.videoSize || null,
    };
    const annotated = [];
    for (const imgB64 of imageBase64List) {
        try {
            // Si viene con prefijo data: lo quitamos para tener base64
            // puro, que es lo que dataUrlToBuffer retorna.
            const buf = dataUrlToBuffer(imgB64) || (Buffer.isBuffer(imgB64) ? imgB64 : null);
            if (!buf) {
                annotated.push(imgB64);
                continue;
            }
            // Llamar a pyimage con la lista de students (1 en este caso).
            const annotatedBuf = await pyimageClient.annotateImage({
                imageBuffer: buf,
                students: [studentForAnnotation],
            });
            annotated.push(annotatedBuf.toString('base64'));
        } catch (e) {
            console.warn(`[alerts] annotate fallo, usando imagen original: ${e.message}`);
            // Fallback: enviar la imagen sin anotar (base64 puro)
            annotated.push(stripDataUrlPrefix(imgB64));
        }
    }
    return annotated;
};

export const processAutomaticDetectionInternal = async (body) => {
    const { idCard, has_uniform, has_accessory, reason, image, faceBox, clothingBoxes, videoSize, cameraId } = body;
    const tiempo = 15 * 1000;
    const ahora = new Date();

    const inicioDia = new Date(ahora.setHours(0, 0, 0, 0));
    const momentoActual = new Date();

    if (!idCard) {
        if (io) {
            // Rooms en vez de broadcast global: solo quien observa la camara
            // (room camera:<id>, ya usada por detection:live_frame) y los
            // admins reciben el payload (~40-60KB con imagen base64).
            io.to(`camera:${cameraId}`).to('role:ADMIN_ROLE').emit('detection:alert', {
                _id: `unknown-${Date.now()}`,
                cameraId: cameraId || null,
                studentCard: null,
                studentName: 'Desconocido',
                studentSurname: '',
                reason: reason || 'PERSONA_DESCONOCIDA',
                infractionCount: 0,
                lastDetection: momentoActual,
                createdAt: momentoActual,
                image: image || '',
                hasUniform: !!has_uniform,
                hasAccessory: !!has_accessory,
                isCoordinatorReport: false,
                isUnknown: true,
                faceBox: faceBox || null,
                clothingBoxes: Array.isArray(clothingBoxes) ? clothingBoxes : [],
                videoSize: videoSize || null,
                grade: null,
            });
        }
        return { status: 200, body: { success: true, message: 'Persona desconocida notificada' } };
    }

    if (has_uniform === true && !has_accessory) {
        return { status: 200, body: { message: "OK" } };
    }

    const estudianteActualizado = await Student.findOneAndUpdate(
        {
            idCard,
            lastInferenceAt: { $lt: new Date(momentoActual - tiempo) }
        },
        {
            $inc: { infractions: 1 },
            $push: {
                tempEvidence: {
                    data: image,
                    reason: reason,
                    timestamp: momentoActual
                }
            },
            $set: { lastInferenceAt: momentoActual }
        },
        { new: true }
    );

    if (!estudianteActualizado) {
        const existeEstudiante = await Student.findOne({ idCard });
        if (!existeEstudiante) {
            console.log(`Estudiante con carnet ${idCard} no encontrado.`);
            return { status: 404, body: { message: "Estudiante no registrado en el sistema." } };
        }
        return { status: 200, body: { message: "Esperando intervalo de seguridad para este estudiante..." } };
    }

    const estudiante = estudianteActualizado;
    const totalInfracciones = estudiante.infractions;

    let alertaActiva = await Alert.findOne({
        studentCard: idCard,
        lastDetection: { $gte: inicioDia }
    }).sort({ lastDetection: -1 });

    if (alertaActiva) {
        alertaActiva.infractionCount += 1;
        alertaActiva.lastDetection = momentoActual;
        alertaActiva.reason = reason;
        await alertaActiva.save();
    } else {
        alertaActiva = new Alert({
            studentCard: idCard,
            infractionCount: 1,
            lastDetection: momentoActual,
            reason
        });
        await alertaActiva.save();
    }

    const coordinador = await Coordinator.findOne({
        grade: estudiante.grade,
        isActive: true
    });

    let destinatarios = [];
    let imagenesAdjuntas = [];
    let esReporteCoordinador = false;

    const coordPref = coordinador
        ? await getPreferencesForUser(coordinador.authUserId)
        : { emailStrategy: 'per_cycle', studentNotify: 'first_only' };
    const studentPref = await getPreferencesForUser(`student:${idCard}`).catch(() => null);
    const studentNotifyMode = studentPref?.studentNotify || 'first_only';

    if (totalInfracciones % 3 === 0) {
        esReporteCoordinador = true;
        const isCritical =
            coordPref.immediateCritical && totalInfracciones >= (coordPref.immediateThreshold || 5);
        const shouldSend = coordPref.emailStrategy === 'per_cycle' || isCritical;
        if (shouldSend) {
            if (coordinador && coordinador.email) {
                destinatarios.push(coordinador.email);
            } else {
                destinatarios.push(process.env.EMAIL_FROM);
            }
        }
        imagenesAdjuntas = estudiante.tempEvidence.map((ev) => stripDataUrlPrefix(ev.data));

        await Student.updateOne({ _id: estudiante._id }, { $set: { tempEvidence: [] } });

        const fullName = `${estudiante.studentName} ${estudiante.studentSurname}`.trim();
        const notifMessage = `${fullName || idCard} acumuló 3 infracciones (${reason === 'UNIFORME_INCOMPLETO' ? 'uniforme incompleto' : 'accesorio no permitido'}).`;
        const baseTarget = { role: 'COORDINATOR_ROLE', grade: estudiante.grade };
        await createNotification({
            type: 'INFRACTION_CYCLE_COMPLETED',
            title: 'Ciclo de infracciones completado',
            message: notifMessage,
            data: {
                studentCard: idCard,
                studentName: estudiante.studentName,
                studentSurname: estudiante.studentSurname,
                grade: estudiante.grade,
                infractionCount: totalInfracciones,
                reason,
            },
            target: baseTarget,
        });
        await createNotification({
            type: 'INFRACTION_CYCLE_COMPLETED',
            title: 'Ciclo de infracciones completado',
            message: notifMessage,
            data: {
                studentCard: idCard,
                studentName: estudiante.studentName,
                studentSurname: estudiante.studentSurname,
                grade: estudiante.grade,
                infractionCount: totalInfracciones,
                reason,
            },
            target: { role: 'ADMIN_ROLE' },
        });
    } else {
        const isFirstInfractionOfDay = totalInfracciones % 3 === 1;
        const shouldEmailStudent =
            studentNotifyMode === 'every' ||
            (studentNotifyMode === 'first_only' && isFirstInfractionOfDay);
        if (shouldEmailStudent && estudiante.email) {
            destinatarios.push(estudiante.email);
        }
        // FIX: el admin envia la imagen como data URL (`data:image/jpeg;base64,XXX`).
        // nodemailer con `encoding: 'base64'` espera el base64 PURO, sin el
        // prefijo data: URL. Si lo dejamos tal cual, el attachment se vuelve
        // un JPEG corrupto que el cliente de correo no puede abrir.
        imagenesAdjuntas = [stripDataUrlPrefix(image)];
    }

    const { subject, html } = generateUniformEmail(
        `${estudiante.studentName} ${estudiante.studentSurname}`,
        totalInfracciones,
        estudiante.grade,
        reason,
        momentoActual
    );

    if (destinatarios.length > 0) {
        // Decorar las imagenes con los bboxes/labels embebidos via
        // pyimage /api/annotate. Asi el estudiante/coordinador que abre
        // el email ve la foto con el nombre del alumno y el motivo
        // de la infraccion ya dibujados, sin necesidad de abrir la app.
        // Si la anotacion falla (pyimage caido, imagen corrupta),
        // caemos al JPEG original para no bloquear el email.
        const imagenesAnotadas = await annotateAlertImages(imagenesAdjuntas, {
            faceBox, clothingBoxes, videoSize, reason,
            studentName: estudiante.studentName, studentSurname: estudiante.studentSurname,
        });
        await sendSmartEmail(destinatarios.join(','), subject, html, imagenesAnotadas);
    }

    if (io) {
        io.to(`camera:${cameraId}`).to('role:ADMIN_ROLE').emit('detection:alert', {
            _id: alertaActiva._id?.toString?.() || alertaActiva._id,
            cameraId: cameraId || null,
            studentCard: idCard,
            studentName: estudiante.studentName,
            studentSurname: estudiante.studentSurname,
            reason,
            infractionCount: alertaActiva.infractionCount,
            lastDetection: momentoActual,
            createdAt: momentoActual,
            image,
            hasUniform: has_uniform,
            hasAccessory: has_accessory,
            isCoordinatorReport: esReporteCoordinador,
            faceBox: faceBox || null,
            clothingBoxes: Array.isArray(clothingBoxes) ? clothingBoxes : [],
            videoSize: videoSize || null,
            grade: estudiante.grade,
        });
    }

    return {
        status: 200,
        body: {
            success: true,
            message: esReporteCoordinador
                ? "Ciclo completado: Reporte enviado al Coordinador"
                : "Advertencia enviada al estudiante",
            currentWarning: (totalInfracciones - 1) % 3 + 1,
        },
    };
};

export const processAutomaticDetection = async (req, res) => {
    try {
        const result = await processAutomaticDetectionInternal(req.body);
        return res.status(result.status).send(result.body);
    } catch (error) {
        console.error("Error en Alerts Controller:", error);
        return res.status(500).send({ message: "Error interno del servidor" });
    }
};

export const simulateAlert = async (req, res) => {
    try {
        const { cameraId, studentCard, studentName, studentSurname, reason, hasUniform, hasAccessory } = req.body;
        if (!cameraId) {
            return res.status(400).json({ success: false, message: 'cameraId es requerido' });
        }
        const isUnknown = studentCard === null || studentCard === undefined || studentCard === '';
        const payload = {
            _id: `simulated-${Date.now()}`,
            cameraId,
            studentCard: isUnknown ? null : studentCard,
            studentName: isUnknown ? 'Desconocido' : (studentName || 'Estudiante'),
            studentSurname: isUnknown ? '' : (studentSurname || 'Demo'),
            reason: isUnknown ? 'PERSONA_DESCONOCIDA' : (reason || 'UNIFORME_INCOMPLETO'),
            infractionCount: isUnknown ? 0 : 1,
            lastDetection: new Date(),
            createdAt: new Date(),
            image: '',
            hasUniform: typeof hasUniform === 'boolean' ? hasUniform : false,
            hasAccessory: typeof hasAccessory === 'boolean' ? hasAccessory : false,
            isCoordinatorReport: false,
            isSimulated: true,
            isUnknown,
            faceBox: req.body.faceBox || { top: 100, right: 540, bottom: 280, left: 360 },
            clothingBoxes: Array.isArray(req.body.clothingBoxes) && req.body.clothingBoxes.length > 0
                ? req.body.clothingBoxes
                : [
                    { class: 'CAMISA', valid: false, box: { x1: 380, y1: 290, x2: 480, y2: 360 } },
                    { class: 'PANTALON', valid: true, box: { x1: 380, y1: 380, x2: 480, y2: 460 } },
                  ],
            videoSize: req.body.videoSize || { width: 640, height: 480 },
            grade: isUnknown ? null : 'TEST',
        };
        if (io) {
            io.to(`camera:${cameraId}`).to('role:ADMIN_ROLE').emit('detection:alert', payload);
            console.log(`[alerts] Simulated alert emitted for ${cameraId} (${isUnknown ? 'unknown' : studentCard})`);
        }
        return res.status(200).json({ success: true, detection: payload });
    } catch (err) {
        console.error('Error en simulateAlert:', err);
        return res.status(500).json({ success: false, message: 'Error al simular la alerta' });
    }
};

export const getAlerts = async (req, res) => {
    try {
        const { studentCard, limit, page } = req.query;
        const filter = {};
        if (studentCard) filter.studentCard = studentCard;
        const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const skip = (parsedPage - 1) * parsedLimit;

        const [alerts, total] = await Promise.all([
            Alert.find(filter).sort({ lastDetection: -1 }).skip(skip).limit(parsedLimit),
            Alert.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            total,
            alerts,
            pagination: {
                currentPage: parsedPage,
                totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
                totalRecords: total,
                limit: parsedLimit,
            },
        });
    } catch (error) {
        console.error("Error al obtener las alertas:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener el historial de alertas"
        });
    }
};
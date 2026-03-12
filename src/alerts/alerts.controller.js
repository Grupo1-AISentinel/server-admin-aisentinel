import Alert from './alerts.model.js';
import Student from '../students/student.model.js';
import Coordinator from '../coordinator/coordinator.model.js';
import { generateUniformEmail, sendSmartEmail } from '../../utils/email-generator.js';

export const processAutomaticDetection = async (req, res) => {
    try {
        const { idCard, has_uniform, has_accessory, reason, image } = req.body;
        const tiempo = 15 * 1000;
        const ahora = new Date();

        const inicioDia = new Date(ahora.setHours(0, 0, 0, 0));
        const momentoActual = new Date(); 

        if (!idCard) {
            console.error("❌ No se recibió el carnet en el body");
            return res.status(400).send({ message: "carnet is required" });
        }

        if (has_uniform === true && !has_accessory) {
            return res.status(200).send({ message: "OK" });
        }

        // 1. Protección de Concurrencia y Actualización Atómica
        // Buscamos el estudiante y lo actualizamos SOLO si ha pasado el tiempo de seguridad
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
            { new: true } // Retornar el documento actualizado
        );

        if (!estudianteActualizado) {
            // Si no se encuentra, puede ser por carnet inexistente o por el intervalo de seguridad
            const existeEstudiante = await Student.findOne({ idCard });
            if (!existeEstudiante) {
                console.log(`Estudiante con carnet ${idCard} no encontrado.`);
                return res.status(404).send({ message: "Estudiante no registrado en el sistema." });
            }
            return res.status(200).send({ message: "Esperando intervalo de seguridad para este estudiante..." });
        }

        const estudiante = estudianteActualizado;
        const totalInfracciones = estudiante.infractions;

        // 2. Manejo de Alerta Diaria (Historial para Estadísticas)
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
                reason: reason 
            });
            await alertaActiva.save();
        }

        // 3. Buscar Coordinador de Grado
        console.log(`Busqueda de coordinador para Estudiante: ${idCard}, Grado: ${estudiante.grade}`);
        const coordinador = await Coordinator.findOne({ 
            grade: estudiante.grade, 
            isActive: true 
        });

        let destinatarios = [];
        let imagenesAdjuntas = [];
        let esReporteCoordinador = false;

        if (totalInfracciones % 3 === 0) {
            // CASO REPORTE: Ciclo de 3 completado
            esReporteCoordinador = true;
            if (coordinador && coordinador.email) {
                destinatarios.push(coordinador.email);
                console.log(`📌 Coordinador encontrado: ${coordinador.email} para grado ${estudiante.grade}`);
            } else {
                console.error(`❌ ERROR CRÍTICO: No se encontró coordinador activo para el grado ${estudiante.grade}.`);
                // Como último recurso para no perder la alerta, se usa el EMAIL_FROM del sistema como aviso técnico
                destinatarios.push(process.env.EMAIL_FROM); 
            }
            // Adjuntar las fotos del ciclo (deberían ser 3)
            imagenesAdjuntas = estudiante.tempEvidence.map(ev => ev.data);
            
            // LIMPIEZA ATÓMICA: Limpiar el array para el próximo ciclo
            await Student.updateOne({ _id: estudiante._id }, { $set: { tempEvidence: [] } });
        } else {
            // CASO ADVERTENCIA: 1/3 o 2/3
            if (estudiante.email) {
                destinatarios.push(estudiante.email);
            } else {
                console.warn(`⚠️ El estudiante ${idCard} no tiene un correo asignado.`);
            }
            imagenesAdjuntas = [image];
        }

        // Generar contenido con Fecha y Hora
        const { subject, html } = generateUniformEmail(
            `${estudiante.studentName} ${estudiante.studentSurname}`,
            totalInfracciones,
            estudiante.grade,
            reason,
            momentoActual
        );

        if (destinatarios.length > 0) {
            // Enviamos el correo (Mantenemos el await para asegurar que el intervalo de seguridad sea efectivo contra spams)
            await sendSmartEmail(destinatarios.join(','), subject, html, imagenesAdjuntas);
            console.log(`✅ Email [${esReporteCoordinador ? 'REPORTE' : 'ADVERTENCIA'}] enviado exitosamente a: ${destinatarios.join(', ')}`);
        }

        return res.status(200).send({ 
            success: true,
            message: esReporteCoordinador 
                ? "Ciclo completado: Reporte enviado al Coordinador" 
                : "Advertencia enviada al estudiante",
            currentWarning: (totalInfracciones - 1) % 3 + 1
        });
    } catch (error) {
        console.error("Error en Alerts Controller:", error);
        return res.status(500).send({ message: "Error interno del servidor" });
    }
};

export const getAlerts = async (req, res) => {
    try {
        const alerts = await Alert.find().sort({ lastDetection: -1 });

        if (alerts.length === 0) {
            return res.status(204).send(); 
        }

        return res.status(200).json({
            success: true,
            total: alerts.length,
            alerts
        });
    } catch (error) {
        console.error("Error al obtener las alertas:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener el historial de alertas"
        });
    }
};
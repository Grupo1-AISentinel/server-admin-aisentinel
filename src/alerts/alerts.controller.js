import Alert from './alerts.model.js';
import Student from '../students/student.model.js';
import Coordinator from '../coordinator/coordinator.model.js';
import { generateUniformEmail, sendSmartEmail } from '../../utils/email-generator.js';

export const processAutomaticDetection = async (req, res) => {
    try {
        const { idCard, has_uniform, image } = req.body;
        const tiempo = 15 * 1000;
        const ahora = new Date();

        const inicioDia = new Date(ahora.setHours(0, 0, 0, 0));
        const momentoActual = new Date(); 

        if (!idCard) {
            console.error("❌ No se recibió idCard en el body");
            return res.status(400).send({ message: "idCard is required" });
        }

        if (has_uniform === true) return res.status(200).send({ message: "OK" });

        const estudiante = await Student.findOne({ idCard });
        if (!estudiante) {
            console.log(`⚠️ Estudiante con carnet ${idCard} no encontrado.`);
            return res.status(404).send({ message: "Estudiante no registrado en el sistema." });
        }

        const coordinador = await Coordinator.findOne({ 
            grade: estudiante.grade, 
            isActive: true 
        });

        let alertaActiva = await Alert.findOne({
            studentCard: idCard,
            lastDetection: { $gte: inicioDia } 
        }).sort({ lastDetection: -1 });

        if (alertaActiva) {
            if (alertaActiva.infractionCount >= 3) {
                console.log(`🚫 Bloqueo: ${idCard} ya alcanzó el límite de 3 alertas HOY.`);
                return res.status(200).send({ message: "Límite diario alcanzado." });
            }

            const tiempoTranscurrido = momentoActual - alertaActiva.lastDetection;
            if (tiempoTranscurrido < tiempo) {
                return res.status(200).send({ message: "Esperando intervalo de seguridad..." });
            }

            alertaActiva.infractionCount += 1;
            alertaActiva.lastDetection = momentoActual;
            await alertaActiva.save();
        } else {
            alertaActiva = new Alert({
                studentCard: idCard,
                infractionCount: 1,
                lastDetection: momentoActual
            });
            await alertaActiva.save();
        }

        const nivel = alertaActiva.infractionCount;

        let destinatarios = [];
        
        if (estudiante.email) {
            destinatarios.push(estudiante.email);
        }

        if (nivel >= 3) {
            if (coordinador && coordinador.email) {
                destinatarios.push(coordinador.email);
                console.log(`📧 Reporte Nivel 3: Incluyendo a coordinador de ${estudiante.grade} (${coordinador.firstName})`);
            } else {
                destinatarios.push("grupo1in6bv@gmail.com"); 
                console.log(`⚠️ No se encontró coordinador activo para ${estudiante.grade}`);
            }
        }

        const { subject, html } = generateUniformEmail(
            `${estudiante.studentName} ${estudiante.studentSurname}`,
            nivel,
            estudiante.grade
        );

        await sendSmartEmail(destinatarios.join(','), subject, html, image);

        console.log(`✅ Alerta Nivel ${nivel} enviada a: ${destinatarios.join(', ')}`);
        return res.status(200).send({ message: "Proceso completado exitosamente" });

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
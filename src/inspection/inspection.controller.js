import { COORDINATOR_ROLE } from '../../middlewares/validate-role.js'
import Inspection from './inspection.model.js'
import Coordinator from '../coordinator/coordinator.model.js'
import { createNotification } from '../notifications/notification.controller.js'
import axios from 'axios'

export const getInspections = async (req, res, next) => {
    try {
        const filter = {};
        if (req.userRole === COORDINATOR_ROLE) {
            const coordinator = await Coordinator.findOne({ authUserId: req.userId });
            if (!coordinator) {
                return res.status(403).json({ success: false, message: 'No se encontró el perfil de coordinador.' });
            }
            filter.grade = coordinator.grade;
        }
        const inspections = await Inspection.find(filter).sort({ grade: 1 });
        res.status(200).json({ success: true, data: inspections });
    } catch (error) {
        next(error);
    }
};

export const toggleInspection = async (req, res, next) => {
    try {

        const { grade } = req.params
        const role = req.userRole
        const uid = req.userId

        // si es coordinador validar grado
        if (role === COORDINATOR_ROLE) {

            const coordinator = await Coordinator.findOne({ authUserId: uid })

            if (!coordinator) {
                return res.status(404).json({
                    success: false,
                    message: 'Coordinador no encontrado'
                })
            }

            if (coordinator.grade !== grade) {
                return res.status(403).json({
                    success: false,
                    message: 'No puede modificar inspecciones de otro grado'
                })
            }
        }

        let inspection = await Inspection.findOne({ grade })

        if (!inspection) {
            inspection = new Inspection({
                grade,
                isActive: false
            })
        }

        inspection.isActive = !inspection.isActive

        await inspection.save()

        try {
            const pythonUrl = process.env.PYTHON_SERVER_URL || 'http://localhost:8000';
            const internalApiKey = process.env.INTERNAL_API_KEY;
            
            await axios.post(`${pythonUrl}/inspeccion/toggle`, {
                activar: inspection.isActive
            }, {
                headers: {
                    'x-internal-api-key': internalApiKey
                }
            });
        } catch (error) {
            console.error('❌ Error al notificar a Python:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Error al notificar a Python'
            })
        }

        const isActive = inspection.isActive;
        const notifType = isActive ? 'INSPECTION_STARTED' : 'INSPECTION_STOPPED';
        const notifTitle = isActive ? 'Inspección iniciada' : 'Inspección detenida';
        const notifMessage = isActive
            ? `Inspección de uniformes activada en ${grade}.`
            : `Inspección de uniformes desactivada en ${grade}.`;

        await createNotification({
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            data: { grade },
            target: { role: 'COORDINATOR_ROLE', grade },
        });
        await createNotification({
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            data: { grade },
            target: { role: 'ADMIN_ROLE' },
        });

        return res.status(200).json({
            success: true,
            message: isActive
                ? 'Inspección activada'
                : 'Inspección desactivada',
            data: inspection
        })

    } catch (error) {
        next(error)
    }
}
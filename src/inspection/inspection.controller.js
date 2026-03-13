import { COORDINATOR_ROLE } from '../../middlewares/validate-role.js'
import Inspection from './inspection.model.js'
import Coordinator from '../coordinator/coordinator.model.js'
import axios from 'axios'

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
            await axios.post('http://localhost:8000/inspeccion/toggle', {
                activar: inspection.isActive
            });
        } catch (error) {
            console.error('❌ Error al notificar a Python:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Error al notificar a Python'
            })
        }

        return res.status(200).json({
            success: true,
            message: inspection.isActive
                ? 'Inspección activada'
                : 'Inspección desactivada',
            data: inspection
        })

    } catch (error) {
        next(error)
    }
}
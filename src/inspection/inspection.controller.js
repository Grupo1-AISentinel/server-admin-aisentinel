import Inspection from './inspection.model.js'
import Coordinator from '../coordinator/coordinator.model.js'

export const toggleInspection = async (req, res, next) => {
    try {

        const { grade } = req.params
        const role = req.userRole
        const uid = req.userId

        // si es coordinador validar grado
        if (role === 'Coordinador') {

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
import Coordinator from '../src/coordinator/coordinator.model.js';
import Student from '../src/students/student.model.js';

export const ADMIN_ROLE = 'ADMIN_ROLE';
export const COORDINATOR_ROLE = 'COORDINATOR_ROLE';

/**
 * Permite solo al Administrador.
 */
export const validateAdmin = (req, res, next) => {
    if (req.userRole !== ADMIN_ROLE) {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Se requiere rol Administrador.',
        });
    }
    next();
};

/**
 * Permite al Administrador o al Coordinador.
 */
export const validateAdminOrCoordinator = (req, res, next) => {
    if (req.userRole !== ADMIN_ROLE && req.userRole !== COORDINATOR_ROLE) {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Se requiere rol Administrador o Coordinador.',
        });
    }
    next();
};

/**
 * Middleware que verifica que un coordinador solo gestione estudiantes de su grado.
 * Si es Administrador, pasa sin restricción.
 * Si es Coordinador, adjunta req.coordinatorGrade para filtrarlo en el controlador.
 */
export const validateCoordinatorGrade = async (req, res, next) => {
    try {
        if (req.userRole === ADMIN_ROLE) {
            req.coordinatorGrade = null; // sin restricción
            return next();
        }

        if (req.userRole === COORDINATOR_ROLE) {
            const coordinator = await Coordinator.findOne({ authUserId: req.userId });

            if (!coordinator) {
                return res.status(403).json({
                    success: false,
                    message: 'No se encontró el perfil de coordinador asociado a su usuario.',
                });
            }

            if (!coordinator.isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Su perfil de coordinador está desactivado.',
                });
            }

            req.coordinatorGrade = coordinator.grade;
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Acceso denegado.',
        });
    } catch (error) {
        next(error);
    }
};


export const validateStudentGradeById = async (req, res, next) => {
    try {
        if (!req.coordinatorGrade) return next();
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        }
        if (student.grade !== req.coordinatorGrade) {
            return res.status(403).json({
                success: false,
                message: `Solo puede gestionar estudiantes del grado ${req.coordinatorGrade}.`,
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};


export const validateStudentGradeByIdCard = async (req, res, next) => {
    try {
        if (!req.coordinatorGrade) return next();
        const student = await Student.findOne({ idCard: req.params.idCard });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        }
        if (student.grade !== req.coordinatorGrade) {
            return res.status(403).json({
                success: false,
                message: `Solo puede gestionar estudiantes del grado ${req.coordinatorGrade}.`,
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};

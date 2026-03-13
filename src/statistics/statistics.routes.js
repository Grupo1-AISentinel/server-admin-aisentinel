import { Router } from 'express';
import { 
    getGradesStatistics, 
    exportGradesStatistics, 
    getStudentsStatistics, 
    exportStudentsStatistics,
    getObjectsStatistics,
    exportObjectsStatistics,
    getDaysStatistics,
    exportDaysStatistics
} from './statistics.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdminOrCoordinator } from '../../middlewares/validate-role.js';

const router = Router();

router.get(
    '/grades',
    validateJWT, 
    validateAdminOrCoordinator, 
    getGradesStatistics
);

router.get(
    '/students', 
    validateJWT, 
    validateAdminOrCoordinator, 
    getStudentsStatistics
);

router.get(
    '/objects',
    validateJWT,
    validateAdminOrCoordinator,
    getObjectsStatistics
);

router.get(
    '/days',
    validateJWT,
    validateAdminOrCoordinator,
    getDaysStatistics
);

router.post(
    '/grades/export', 
    validateJWT, 
    validateAdminOrCoordinator, 
    exportGradesStatistics
);

router.post(
    '/students/export', 
    validateJWT, 
    validateAdminOrCoordinator, 
    exportStudentsStatistics
);

router.post(
    '/objects/export',
    validateJWT,
    validateAdminOrCoordinator,
    exportObjectsStatistics
);

router.post(
    '/days/export',
    validateJWT,
    validateAdminOrCoordinator,
    exportDaysStatistics
);

export default router;
import { Router } from 'express';
import { 
    getGradesStatistics, 
    exportGradesStatistics, 
    getStudentsStatistics, 
    exportStudentsStatistics 
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

export default router;
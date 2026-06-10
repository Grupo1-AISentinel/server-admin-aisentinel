import { Router } from 'express';
import {
    processAutomaticDetection,
    getAlerts,
    simulateAlert,
} from './alerts.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdmin, validateAdminOrCoordinator } from '../../middlewares/validate-role.js';

const router = Router();

router.post('/automatic-detection', processAutomaticDetection);
router.post('/simulate', validateJWT, validateAdmin, simulateAlert);
router.get('/get', validateJWT, validateAdminOrCoordinator, getAlerts);

export default router;

import { Router } from 'express';
import { getAuditLogs } from './audit.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdmin } from '../../middlewares/validate-role.js';

const router = Router();

router.get(
    '/get', 
    validateJWT, 
    validateAdmin, 
    getAuditLogs
);

export default router;
'use strict';

import { Router } from 'express';
import { getMyPreferences, upsertMyPreferences } from './preference.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdminOrCoordinator } from '../../middlewares/validate-role.js';

const router = Router();

router.use(validateJWT, validateAdminOrCoordinator);

router.get('/alerts', getMyPreferences);
router.put('/alerts', upsertMyPreferences);

export default router;

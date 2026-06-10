'use strict';

import { Router } from 'express';
import { getMyNotifications, getUnreadCount, markAllAsRead } from './notification.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdminOrCoordinator } from '../../middlewares/validate-role.js';

const router = Router();

router.use(validateJWT, validateAdminOrCoordinator);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/mark-read', markAllAsRead);

export default router;

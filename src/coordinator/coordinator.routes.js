import { Router } from 'express';
import {
    createCoordinator,
    createAdmin,
    getCoordinators,
    getCoordinatorById,
    updateCoordinator,
    deleteCoordinator,
    activateCoordinator,
    deactivateCoordinator,
} from './coordinator.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdmin } from '../../middlewares/validate-role.js';
import {
    validateCreateCoordinator,
    validateCreateAdmin,
    validateUpdateCoordinator,
    validateCoordinatorId,
    validateGetCoordinators,
} from '../../middlewares/coordinator-validators.js';

const router = Router();

router.use(validateJWT, validateAdmin);

router.post('/create', validateCreateCoordinator, createCoordinator);
router.post('/admin/create', validateCreateAdmin, createAdmin);
router.get('/get', validateGetCoordinators, getCoordinators);
router.get('/:id', validateCoordinatorId, getCoordinatorById);
router.put('/:id', validateUpdateCoordinator, updateCoordinator);
router.put('/:id/activate', validateCoordinatorId, activateCoordinator);
router.put('/:id/deactivate', validateCoordinatorId, deactivateCoordinator);
router.delete('/:id', validateCoordinatorId, deleteCoordinator);

export default router;

import { Router } from 'express';
import { uploadModel3D } from '../../middlewares/models3d-uploader.js';
import { cleanLocalFileOnFinish, deleteLocalFileOnError } from '../../middlewares/delete-local-file.js';
import {
    validateCreateModel3D,
    validateUpdateModel3D,
    validateModel3DId,
    validateGetModel3Ds,
    validateUniqueModel3DName,
} from '../../middlewares/models3d-validators.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdmin } from '../../middlewares/validate-role.js';
import {
    createModel3D,
    getModel3Ds,
    getModel3DById,
    updateModel3D,
    activateModel3D,
    deactivateModel3D,
    deleteModel3D,
} from './models3d.controller.js';

const router = Router();

router.use(validateJWT);

router.get('/get', validateGetModel3Ds, getModel3Ds);
router.get('/:id', validateModel3DId, getModel3DById);

router.use(validateAdmin);

router.post(
    '/create',
    uploadModel3D.single('file'),
    cleanLocalFileOnFinish,
    validateCreateModel3D,
    validateUniqueModel3DName,
    createModel3D
);

router.put(
    '/:id',
    validateModel3DId,
    validateUpdateModel3D,
    updateModel3D
);

router.put('/:id/activate', validateModel3DId, activateModel3D);
router.put('/:id/deactivate', validateModel3DId, deactivateModel3D);
router.delete('/:id', validateModel3DId, deleteModel3D);

router.use(deleteLocalFileOnError);

export default router;

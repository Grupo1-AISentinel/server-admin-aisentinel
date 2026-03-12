import { Router } from 'express';
import {
    createUniform,
    getUniforms,
    getUniformByName,
    getUniformThumbnail,
    updateUniform,
    activateUniform,
    deactivateUniform,
    autoSyncUniform
} from './uniform.controller.js';
import { uploadStudentImage } from '../../middlewares/file-uploader.js';
import { cleanUploaderFileOnFinish, deleteFileOnError } from '../../middlewares/delete-file-on-error.js';
import {
    validateCreateUniform,
    validateUpdateUniform,
    validateUniformName,
    validateGetUniforms,
    validateAutoSyncUniform
} from '../../middlewares/uniform-validators.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdminOrCoordinator } from '../../middlewares/validate-role.js';

const router = Router();

router.post('/auto-sync', validateAutoSyncUniform, autoSyncUniform);
router.get('/:name/thumbnail', validateUniformName, getUniformThumbnail);

router.use(validateJWT);
router.use(validateAdminOrCoordinator);

router.post(
    '/create',
    uploadStudentImage.any(),
    cleanUploaderFileOnFinish,
    validateCreateUniform,
    createUniform
);

router.get(
    '/get',
    validateGetUniforms,
    getUniforms
);

router.get('/:name', validateUniformName, getUniformByName);

router.put(
    '/:name',
    uploadStudentImage.any(),
    cleanUploaderFileOnFinish,
    validateUpdateUniform,
    updateUniform
);

router.put('/:name/activate', validateUniformName, activateUniform);

router.put('/:name/deactivate', validateUniformName, deactivateUniform);

router.use(deleteFileOnError);

export default router;

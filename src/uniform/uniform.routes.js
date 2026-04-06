import { Router } from 'express';
import { validateCreateUniform, validateUpdateUniform, validateUniformName, validateGetUniforms, validateAutoSyncUniform, validateExistingUniform } from '../../middlewares/uniform-validators.js';
import { createUniform, getUniforms, getUniformByName, getUniformThumbnail, updateUniform, activateUniform, deactivateUniform, seederUniforms } from './uniform.controller.js';

import { uploadUniformImage } from '../../middlewares/file-uploader.js';
import { cleanUploaderFileOnFinish, deleteFileOnError } from '../../middlewares/delete-file-on-error.js';

import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdminOrCoordinator } from '../../middlewares/validate-role.js';

const router = Router();
// Esto se llama desde el seeder de python
router.post('/seeder-uniforms',
    uploadUniformImage.single('image'),
    cleanUploaderFileOnFinish,
    validateExistingUniform,
    validateAutoSyncUniform,
    seederUniforms);
router.get('/:name/thumbnail', validateUniformName, getUniformThumbnail);

router.use(validateJWT);
router.use(validateAdminOrCoordinator);

router.post(
    '/create',
    uploadUniformImage.single('image'),
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

router.put('/:name/desactivate', validateUniformName, deactivateUniform);

router.use(deleteFileOnError);

export default router;

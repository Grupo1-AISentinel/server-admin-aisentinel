import { Router } from 'express';
import { changeFieldStatus, createField, getFieldById, getFields, updateField } from './field.controller.js';
import { uploadFieldImage } from '../../middlewares/file-uploader.js';
import { cleanUploaderFileOnFinish } from '../../middlewares/delete-file-on-error.js';
import { validateCreateField, validateFieldStatusChange, validateGetFieldById, validateUpdateFieldRequest } from '../../middlewares/field-validators.js';

const router = Router();

router.post(
    '/create',
    uploadFieldImage.single('image'),
    cleanUploaderFileOnFinish,
    validateCreateField,
    createField
)

router.get(
    '/get',
    getFields
)

router.get('/:id', validateGetFieldById, getFieldById);

// Rutas PUT - Requieren autenticación
router.put(
    '/:id',
    uploadFieldImage.single('image'),
    cleanUploaderFileOnFinish,
    validateUpdateFieldRequest,
    updateField
);
router.put('/:id/activate', validateFieldStatusChange, changeFieldStatus);
router.put('/:id/deactivate', validateFieldStatusChange, changeFieldStatus);
export default router;
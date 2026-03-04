import { Router } from 'express';
import { activateField, deactivateField, deleteField, createField, getFieldById, getFields, updateField, getFieldByIdCard, updateFieldByIdCard, activateFieldByIdCard, deactivateFieldByIdCard, deleteFieldByIdCard } from './field.controller.js';
import { uploadFieldImages } from '../../middlewares/file-uploader.js';
import { cleanUploaderFileOnFinish, deleteFileOnError } from '../../middlewares/delete-file-on-error.js';
import { validateCreateField, validateDeleteField, validateFieldStatusChange, validateGetFieldById, validateGetFields, validateUpdateFieldRequest, validateByIdCard, validateUpdateByIdCard } from '../../middlewares/field-validators.js';

const router = Router();

router.post(
    '/create',
    uploadFieldImages,
    cleanUploaderFileOnFinish,
    validateCreateField,
    createField
)

router.get(
    '/get',
    ...validateGetFields,
    getFields
)

router.get('/:id', ...validateGetFieldById, getFieldById);

// Rutas PUT - Requieren autenticación
router.put(
    '/:id',
    uploadFieldImages,
    cleanUploaderFileOnFinish,
    validateUpdateFieldRequest,
    updateField
);
router.put('/:id/activate', validateFieldStatusChange, activateField);
router.put('/:id/deactivate', validateFieldStatusChange, deactivateField);
router.delete('/:id', ...validateDeleteField, deleteField);

// Rutas por carnet (idCard)
router.get('/idcard/:idCard', ...validateByIdCard, getFieldByIdCard);
router.put('/idcard/:idCard', uploadFieldImages, cleanUploaderFileOnFinish, ...validateUpdateByIdCard, updateFieldByIdCard);
router.put('/idcard/:idCard/activate', ...validateByIdCard, activateFieldByIdCard);
router.put('/idcard/:idCard/deactivate', ...validateByIdCard, deactivateFieldByIdCard);
router.delete('/idcard/:idCard', ...validateByIdCard, deleteFieldByIdCard);

router.use(deleteFileOnError);

export default router;
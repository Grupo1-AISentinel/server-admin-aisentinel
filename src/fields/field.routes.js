import { Router } from 'express';
import { activateField, deactivateField, deleteField, createField, getFieldById, getFields, updateField, getFieldByIdCard, updateFieldByIdCard, activateFieldByIdCard, deactivateFieldByIdCard, deleteFieldByIdCard } from './field.controller.js';
import { uploadFieldImage } from '../../middlewares/file-uploader.js';
import { cleanUploaderFileOnFinish, deleteFileOnError } from '../../middlewares/delete-file-on-error.js';
import { validateCreateField, validateDeleteField, validateFieldStatusChange, validateGetFieldById, validateGetFields, validateUpdateFieldRequest, validateByIdCard, validateUpdateByIdCard } from '../../middlewares/field-validators.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdminOrCoordinator, validateAdmin, validateCoordinatorGrade } from '../../middlewares/validate-role.js';

const router = Router();

// Crear estudiante: Admin o Coordinador (coordinador solo su grado)
router.post(
    '/create',
    validateJWT,
    validateAdminOrCoordinator,
    validateCoordinatorGrade,
    uploadFieldImage.single('photo'),
    cleanUploaderFileOnFinish,
    validateCreateField,
    createField
)

// Listar estudiantes: Admin o Coordinador
router.get(
    '/get',
    validateJWT,
    validateAdminOrCoordinator,
    ...validateGetFields,
    getFields
)

router.get('/:id', validateJWT, validateAdminOrCoordinator, ...validateGetFieldById, getFieldById);

// Actualizar: Admin o Coordinador (coordinador solo su grado)
router.put(
    '/:id',
    validateJWT,
    validateAdminOrCoordinator,
    validateCoordinatorGrade,
    uploadFieldImage.single('photo'),
    cleanUploaderFileOnFinish,
    validateUpdateFieldRequest,
    updateField
);

// Activar / Desactivar / Eliminar: solo Admin
router.put('/:id/activate', validateJWT, validateAdmin, validateFieldStatusChange, activateField);
router.put('/:id/deactivate', validateJWT, validateAdmin, validateFieldStatusChange, deactivateField);
router.delete('/:id', validateJWT, validateAdmin, ...validateDeleteField, deleteField);

// Rutas por carnet (idCard)
router.get('/idcard/:idCard', validateJWT, validateAdminOrCoordinator, ...validateByIdCard, getFieldByIdCard);

// Actualizar por carnet: Admin o Coordinador (coordinador solo su grado)
router.put(
    '/idcard/:idCard',
    validateJWT,
    validateAdminOrCoordinator,
    validateCoordinatorGrade,
    uploadFieldImage.single('photo'),
    cleanUploaderFileOnFinish,
    ...validateUpdateByIdCard,
    updateFieldByIdCard
);

// Activar / Desactivar / Eliminar por carnet: solo Admin
router.put('/idcard/:idCard/activate', validateJWT, validateAdmin, ...validateByIdCard, activateFieldByIdCard);
router.put('/idcard/:idCard/deactivate', validateJWT, validateAdmin, ...validateByIdCard, deactivateFieldByIdCard);
router.delete('/idcard/:idCard', validateJWT, validateAdmin, ...validateByIdCard, deleteFieldByIdCard);

router.use(deleteFileOnError);

export default router;
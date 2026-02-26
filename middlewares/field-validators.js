import { body, param } from 'express-validator';
import { checkValidators } from './checkValidators.js';

// Validaciones para crear estudiante
export const validateCreateField = [
    body('fieldName')
        .trim()
        .notEmpty()
        .withMessage('El nombre del estudiante es requerido')
        .isLength({ max: 50 })
        .withMessage('El nombre no puede exceder 50 caracteres'),
    body('fieldSurname')
        .trim()
        .notEmpty()
        .withMessage('El apellido del estudiante es requerido')
        .isLength({ max: 50 })
        .withMessage('El apellido no puede exceder 50 caracteres'),
    body('idCard')
        .trim()
        .notEmpty()
        .withMessage('El carnet de identidad es requerido')
        .isLength({ max: 7 })
        .withMessage('El carnet no puede exceder 7 caracteres'),
    body('grade')
        .notEmpty()
        .withMessage('El grado del estudiante es requerido')
        .isIn(['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'])
        .withMessage('Grado no válido'),
    body('photo')
        .optional()
        .isString()
        .withMessage('La foto debe ser una cadena de texto'),
    checkValidators,
];

// Validaciones para actualizar estudiante
export const validateUpdateFieldRequest = [
    param('id')
        .isMongoId()
        .withMessage('ID debe ser un ObjectId válido de MongoDB'),
    body('fieldName')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('El nombre no puede exceder 50 caracteres'),
    body('fieldSurname')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('El apellido no puede exceder 50 caracteres'),
    body('idCard')
        .optional()
        .trim()
        .isLength({ max: 7 })
        .withMessage('El carnet no puede exceder 7 caracteres'),
    body('grade')
        .optional()
        .isIn(['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'])
        .withMessage('Grado no válido'),
    body('photo')
        .optional()
        .isString()
        .withMessage('La foto debe ser una cadena de texto'),
    checkValidators,
];

// Validaciones para cambiar estado del estudiante
export const validateFieldStatusChange = [
    param('id')
        .isMongoId()
        .withMessage('ID debe ser un ObjectId válido de MongoDB'),
    checkValidators,
];

// Validaciones para eliminar campo
export const validateDeleteField = [
    param('id')
        .isMongoId()
        .withMessage('ID debe ser un ObjectId válido de MongoDB'),
    checkValidators,
];

// Validaciones para listar campos
export const validateGetFields = [
    checkValidators,
];

// Validaciones para obtener estudiante por ID
export const validateGetFieldById = [
    param('id')
        .isMongoId()
        .withMessage('ID debe ser un ObjectId válido de MongoDB'),
    checkValidators,
];

// Validaciones para operaciones por carnet
export const validateByIdCard = [
    param('idCard')
        .trim()
        .notEmpty().withMessage('El carnet es requerido')
        .isLength({ max: 7 }).withMessage('El carnet no puede exceder 7 caracteres'),
    checkValidators,
];

// Validaciones para actualizar por carnet
export const validateUpdateByIdCard = [
    param('idCard')
        .trim()
        .notEmpty().withMessage('El carnet es requerido')
        .isLength({ max: 7 }).withMessage('El carnet no puede exceder 7 caracteres'),
    body('fieldName').optional().trim().isLength({ max: 50 }).withMessage('El nombre no puede exceder 50 caracteres'),
    body('fieldSurname').optional().trim().isLength({ max: 50 }).withMessage('El apellido no puede exceder 50 caracteres'),
    body('idCard').optional().trim().isLength({ max: 7 }).withMessage('El carnet no puede exceder 7 caracteres'),
    body('grade').optional().isIn(['1RO', '2DO', '3RO', '4TO', '5TO', '6TO']).withMessage('Grado no válido'),
    body('photo').optional().isString().withMessage('La foto debe ser una cadena de texto'),
    checkValidators,
];
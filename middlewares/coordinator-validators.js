import { body, param, query } from 'express-validator';
import { checkValidators } from './checkValidators.js';

const userFields = [
    body('name')
        .trim()
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ max: 25 }).withMessage('El nombre no puede exceder 25 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('El nombre solo puede contener letras'),
    body('surname')
        .trim()
        .notEmpty().withMessage('El apellido es requerido')
        .isLength({ max: 25 }).withMessage('El apellido no puede exceder 25 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('El apellido solo puede contener letras'),
    body('username')
        .trim()
        .notEmpty().withMessage('El nombre de usuario es requerido')
        .isLength({ min: 3, max: 50 }).withMessage('El username debe tener entre 3 y 50 caracteres')
        .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('El username solo puede contener letras, números, guiones y puntos'),
    body('email')
        .trim()
        .notEmpty().withMessage('El email es requerido')
        .isEmail().withMessage('El email no tiene un formato válido')
        .isLength({ max: 150 }).withMessage('El email no puede exceder 150 caracteres'),
    body('password')
        .notEmpty().withMessage('La contraseña es requerida')
        .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('phone')
        .optional()
        .trim()
        .isLength({ max: 15 }).withMessage('El teléfono no puede exceder 15 caracteres'),
];

export const validateCreateCoordinator = [
    ...userFields,
    body('grade')
        .notEmpty().withMessage('El grado es requerido')
        .isIn(['1RO', '2DO', '3RO', '4TO', '5TO', '6TO']).withMessage('Grado no válido. Use: 1RO, 2DO, 3RO, 4TO, 5TO o 6TO'),
    checkValidators,
];

export const validateCreateAdmin = [
    ...userFields,
    checkValidators,
];

export const validateUpdateCoordinator = [
    param('id').isMongoId().withMessage('ID debe ser un ObjectId válido de MongoDB'),
    body('grade')
        .optional()
        .isIn(['1RO', '2DO', '3RO', '4TO', '5TO', '6TO']).withMessage('Grado no válido'),
    body('phone')
        .optional()
        .trim()
        .isLength({ max: 15 }).withMessage('El teléfono no puede exceder 15 caracteres'),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive debe ser verdadero o falso'),
    checkValidators,
];

export const validateCoordinatorId = [
    param('id').isMongoId().withMessage('ID debe ser un ObjectId válido de MongoDB'),
    checkValidators,
];

export const validateGetCoordinators = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('El límite debe ser entre 1 y 100'),
    query('grade')
        .optional()
        .isIn(['1RO', '2DO', '3RO', '4TO', '5TO', '6TO']).withMessage('Grado no válido'),
    query('isActive')
        .optional()
        .isIn(['true', 'false']).withMessage('isActive debe ser "true" o "false"'),
    checkValidators,
];

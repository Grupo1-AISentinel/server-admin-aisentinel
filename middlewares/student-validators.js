import { body, param } from 'express-validator';
import { checkValidators } from './checkValidators.js';

// Validaciones para crear estudiante
export const validateCreateStudent = [
    body('studentName')
        .trim()
        .notEmpty()
        .withMessage('El nombre del estudiante es requerido')
        .isLength({ max: 50 })
        .withMessage('El nombre no puede exceder 50 caracteres'),
    body('studentSurname')
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
    body('email')
        .trim()
        .notEmpty().withMessage('El correo del estudiante es requerido')
        .isEmail().withMessage('El correo no tiene un formato válido')
        .isLength({ max: 150 }).withMessage('El correo no puede exceder 150 caracteres'),
    body('photo')
        .custom((value, { req }) => {
            if (!req.files || req.files.length < 3) {
                throw new Error('Tienen que ser como minimo 3 imagenes');
            }
            return true;
        }),
    body('photo.*')
        .notEmpty()
        .withMessage('La imagen no puede estar vacía'),
    checkValidators,
];

// Validaciones para actualizar estudiante
export const validateUpdateStudent = [
    param('id')
        .isMongoId()
        .withMessage('ID debe ser un ObjectId válido de MongoDB'),
    body('studentName')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('El nombre no puede exceder 50 caracteres'),
    body('studentSurname')
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
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('El correo no tiene un formato válido')
        .isLength({ max: 150 }).withMessage('El correo no puede exceder 150 caracteres'),
    body('photo')
        .optional()
        .isArray({ min: 3 })
        .withMessage('Tienen que ser como minimo 3 imagenes'),
    body('photo.*')
        .optional()
        .notEmpty()
        .withMessage('La imagen no puede estar vacía'),
    checkValidators,
];

// Validaciones para cambiar estado del estudiante
export const validateStudentStatusChange = [
    param('id')
        .isMongoId()
        .withMessage('ID debe ser un ObjectId válido de MongoDB'),
    checkValidators,
];

// Validaciones para eliminar estudiante
export const validateDeleteStudent = [
    param('id')
        .isMongoId()
        .withMessage('ID debe ser un ObjectId válido de MongoDB'),
    checkValidators,
];

// Validaciones para listar estudiantes
export const validateGetStudents = [
    checkValidators,
];

// Validaciones para obtener estudiante por ID
export const validateGetStudentById = [
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
    body('studentName').optional().trim().isLength({ max: 50 }).withMessage('El nombre no puede exceder 50 caracteres'),
    body('studentSurname').optional().trim().isLength({ max: 50 }).withMessage('El apellido no puede exceder 50 caracteres'),
    body('idCard').optional().trim().isLength({ max: 7 }).withMessage('El carnet no puede exceder 7 caracteres'),
    body('grade').optional().isIn(['1RO', '2DO', '3RO', '4TO', '5TO', '6TO']).withMessage('Grado no válido'),
    body('email').optional().trim().isEmail().withMessage('El correo no tiene un formato válido').isLength({ max: 150 }).withMessage('El correo no puede exceder 150 caracteres'),
    body('photo').optional().exists().withMessage('Las imagenes del estudiante son necesarias').isArray({ min: 3 }).withMessage('Tienen que ser como minimo 3 imagenes'),
    body('photo.*').optional().notEmpty().withMessage('La imagen no puede estar vacía'),
    checkValidators,
];
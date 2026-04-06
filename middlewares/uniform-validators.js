import { body, param, query } from 'express-validator';
import { checkValidators } from './checkValidators.js';

const VALID_TYPES = ['JACKET', 'TSHIRT', 'PANTS'];

export const validateCreateUniform = [
    body('name')
        .trim()
        .notEmpty().withMessage('El nombre del uniforme es requerido')
        .isLength({ max: 80 }).withMessage('El nombre no puede exceder 80 caracteres'),
    body('type')
        .notEmpty().withMessage('El tipo de uniforme es requerido')
        .isIn(VALID_TYPES).withMessage(`Tipo no válido. Valores permitidos: ${VALID_TYPES.join(', ')}`),
    body()
        .custom((value, { req }) => {
            if (!req.files || req.files.length < 3) {
                throw new Error('Se requieren al menos 3 imágenes para el uniforme');
            }
            return true;
        }),
    checkValidators
];

export const validateUpdateUniform = [
    param('name')
        .trim()
        .notEmpty().withMessage('El nombre del uniforme es requerido en la URL'),
    body('name')
        .optional({ values: 'undefined' })
        .trim()
        .notEmpty().withMessage('El nombre no puede estar vacío si se proporciona')
        .isLength({ max: 80 }).withMessage('El nombre no puede exceder 80 caracteres'),
    body('type')
        .optional({ values: 'undefined' })
        .notEmpty().withMessage('El tipo no puede estar vacío si se proporciona')
        .isIn(VALID_TYPES).withMessage(`Tipo no válido. Valores permitidos: ${VALID_TYPES.join(', ')}`),
    body()
        .custom((value, { req }) => {
            const hasName = req.body.name && req.body.name.trim() !== '';
            const hasType = req.body.type && req.body.type.trim() !== '';
            const hasPhotos = req.files && req.files.length >= 3;

            if (!hasPhotos) {
                throw new Error('Se requieren al menos 3 imágenes para actualizar el uniforme');
            }
            if (!hasName && !hasType) {
                throw new Error('Debes enviar al menos name o type junto con las imágenes');
            }
            return true;
        }),
    checkValidators
];

export const validateUniformName = [
    param('name')
        .trim()
        .notEmpty().withMessage('El nombre del uniforme es requerido'),
    checkValidators
];

export const validateGetUniforms = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('El límite debe ser entre 1 y 100'),
    query('type')
        .optional()
        .isIn(VALID_TYPES).withMessage(`Tipo no válido. Valores permitidos: ${VALID_TYPES.join(', ')}`),
    query('isActive')
        .optional()
        .isBoolean().withMessage('isActive debe ser true o false'),
    checkValidators
];

const VALID_IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const validateAutoSyncUniform = [
    body('name')
        .trim()
        .notEmpty().withMessage('El nombre del uniforme es requerido')
        .isLength({ max: 80 }).withMessage('El nombre no puede exceder 80 caracteres'),
    body('type')
        .notEmpty().withMessage('El tipo de uniforme es requerido')
        .isIn(VALID_TYPES).withMessage(`Tipo no válido. Valores permitidos: ${VALID_TYPES.join(', ')}`),
    body('thumbnail')
        .notEmpty().withMessage('El thumbnail es requerido')
        .isObject().withMessage('El thumbnail debe ser un objeto con data y mimetype'),
    body('thumbnail.data')
        .notEmpty().withMessage('Los datos del thumbnail son requeridos')
        .isString().withMessage('Los datos del thumbnail deben ser un string base64')
        .custom((value) => {
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(value)) {
                throw new Error('Los datos del thumbnail no son un base64 válido');
            }
            return true;
        }),
    body('thumbnail.mimetype')
        .notEmpty().withMessage('El mimetype del thumbnail es requerido')
        .isIn(VALID_IMAGE_MIMETYPES).withMessage(`Mimetype no válido. Valores permitidos: ${VALID_IMAGE_MIMETYPES.join(', ')}`),
    checkValidators
];


export const validateExistingUniform = async (req, res, next) => {
    try {
        const { name } = req.body;
        const existing = await Uniform.findOne({ name });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Uniforme ya existe'
            });
        }
        next();
    } catch (error) {
        next(error);
    }
}
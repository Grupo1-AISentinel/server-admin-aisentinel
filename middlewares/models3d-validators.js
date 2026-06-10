import { body, param, query } from 'express-validator';
import { checkValidators } from './checkValidators.js';
import Model3D from '../src/models3d/models3d.model.js';

const VALID_SLOTS = ['body', 'upper', 'lower', 'outerwear', 'accessory'];

export const validateCreateModel3D = [
    body('name')
        .trim()
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ max: 80 }).withMessage('El nombre no puede exceder 80 caracteres')
        .matches(/^[a-z0-9-]+$/).withMessage('El nombre solo puede contener letras minusculas, numeros y guiones'),
    body('displayName')
        .trim()
        .notEmpty().withMessage('El nombre visible es requerido')
        .isLength({ max: 120 }).withMessage('El nombre visible no puede exceder 120 caracteres'),
    body('slot')
        .notEmpty().withMessage('El slot es requerido')
        .isIn(VALID_SLOTS).withMessage(`Slot no valido. Valores permitidos: ${VALID_SLOTS.join(', ')}`),
    body('era')
        .optional({ values: 'undefined' })
        .trim()
        .isLength({ max: 20 }).withMessage('La era no puede exceder 20 caracteres'),
    checkValidators,
];

export const validateUpdateModel3D = [
    param('id')
        .isMongoId().withMessage('ID no valido'),
    body('displayName')
        .optional({ values: 'undefined' })
        .trim()
        .notEmpty().withMessage('El nombre visible no puede estar vacio')
        .isLength({ max: 120 }),
    body('slot')
        .optional({ values: 'undefined' })
        .isIn(VALID_SLOTS).withMessage(`Slot no valido. Valores permitidos: ${VALID_SLOTS.join(', ')}`),
    body('era')
        .optional({ values: 'undefined' })
        .trim()
        .isLength({ max: 20 }),
    checkValidators,
];

export const validateModel3DId = [
    param('id')
        .isMongoId().withMessage('ID no valido'),
    checkValidators,
];

export const validateGetModel3Ds = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('La pagina debe ser un numero entero positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('El limite debe ser entre 1 y 100'),
    query('slot')
        .optional()
        .isIn(VALID_SLOTS).withMessage(`Slot no valido. Valores permitidos: ${VALID_SLOTS.join(', ')}`),
    query('isActive')
        .optional()
        .isBoolean().withMessage('isActive debe ser true o false'),
    checkValidators,
];

export const validateUniqueModel3DName = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return next();
        const existing = await Model3D.findOne({ name: name.toLowerCase() });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Ya existe un modelo 3D con el nombre "${name}". Use PUT para actualizar o elija otro nombre.`,
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};

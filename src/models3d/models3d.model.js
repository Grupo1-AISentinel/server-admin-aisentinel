'use strict';

import mongoose from 'mongoose';

const VALID_SLOTS = ['body', 'upper', 'lower', 'outerwear', 'accessory'];

const Model3DSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'El nombre del modelo 3D es requerido'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^[a-z0-9-]+$/, 'El nombre solo puede contener letras minusculas, numeros y guiones'],
            maxLength: [80, 'El nombre no puede exceder 80 caracteres'],
        },
        display_name: {
            type: String,
            required: [true, 'El nombre visible es requerido'],
            trim: true,
            maxLength: [120, 'El nombre visible no puede exceder 120 caracteres'],
        },
        slot: {
            type: String,
            required: [true, 'El slot es requerido'],
            enum: {
                values: VALID_SLOTS,
                message: `Slot no valido. Valores permitidos: ${VALID_SLOTS.join(', ')}`,
            },
        },
        era: {
            type: String,
            trim: true,
            maxLength: [20, 'La era no puede exceder 20 caracteres'],
        },
        file_path: {
            type: String,
            required: [true, 'La ruta del archivo es requerida'],
        },
        file_size: {
            type: Number,
            required: true,
            min: [0, 'El tamano del archivo no puede ser negativo'],
        },
        uploaded_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: { createdAt: 'uploaded_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

Model3DSchema.index({ is_active: 1, slot: 1 });
Model3DSchema.index({ name: 1 }, { unique: true });

export const VALID_MODEL3D_SLOTS = VALID_SLOTS;
export default mongoose.model('Model3D', Model3DSchema);

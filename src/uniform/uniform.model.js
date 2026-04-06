'use strict';

import mongoose from "mongoose";

const UniformSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'El nombre del uniforme es requerido'],
            trim: true,
            unique: true,
            maxLength: [80, 'El nombre no puede exceder 80 caracteres']
        },
        type: {
            type: String,
            required: [true, 'El tipo de uniforme es requerido'],
            enum: {
                values: ['JACKET', 'TSHIRT', 'PANTS'],
                message: 'Tipo de uniforme no válido. Valores permitidos: JACKET, TSHIRT, PANTS'
            }
        },
        photo: {
            type: String,
            required: [true, 'La foto del uniforme es requerida']
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

UniformSchema.index({ isActive: 1 });
UniformSchema.index({ type: 1 });
UniformSchema.index({ isActive: 1, type: 1 });

export default mongoose.model('Uniform', UniformSchema);

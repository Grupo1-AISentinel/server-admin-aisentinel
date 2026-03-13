'use strict';

import mongoose from 'mongoose';

const coordinatorSchema = mongoose.Schema(
    {
        authUserId: {
            type: String,
            required: [true, 'El ID del usuario de autenticación es requerido'],
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'El correo del coordinador es requerido'],
            trim: true,
            unique: true,
            maxLength: [150, 'El correo no puede exceder 150 caracteres'],
            match: [/^\S+@\S+\.\S+$/, 'El correo no tiene un formato válido']
        },
        firstName: {
            type: String,
            required: [true, 'El nombre del coordinador es requerido'],
            trim: true,
            maxLength: [25, 'El nombre no puede exceder 25 caracteres'],
        },
        lastName: {
            type: String,
            required: [true, 'El apellido del coordinador es requerido'],
            trim: true,
            maxLength: [25, 'El apellido no puede exceder 25 caracteres'],
        },
        grade: {
            type: String,
            required: [true, 'El grado asignado es requerido'],
            enum: {
                values: ['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'],
                message: 'Grado no válido. Use: 1RO, 2DO, 3RO, 4TO, 5TO o 6TO',
            },
        },
        phone: {
            type: String,
            trim: true,
            maxLength: [15, 'El teléfono no puede exceder 15 caracteres'],
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// authUserId ya tiene unique:true declarado en el campo, no se duplica aquí
coordinatorSchema.index({ grade: 1 });
coordinatorSchema.index({ isActive: 1 });

export default mongoose.model('Coordinator', coordinatorSchema);

'use strict';

import mongoose from "mongoose";

const StudentSchema = mongoose.Schema(
    {
        studentName: {
            type: String,
            required: [true, 'El nombre del estudiante es requerido'],
            trim: true,
            maxLength: [50, 'El nombre no puede exceder 50 caracteres']
        },
        studentSurname: {
            type: String,
            required: [true, 'El apellido del estudiante es requerido'],
            trim: true,
            maxLength: [50, 'El apellido no puede exceder 50 caracteres']
        },
        email: {
            type: String,
            required: [true, 'El correo del estudiante es requerido'],
            trim: true,
            unique: true,
            maxLength: [150, 'El correo no puede exceder 150 caracteres'],
            match: [/^\S+@\S+\.\S+$/, 'El correo no tiene un formato válido']
        },
        idCard: {
            type: String,
            required: [true, 'El carnet de identidad es requerido'],
            trim: true,
            unique: true,
            maxLength: [7, 'El carnet no puede exceder 7 caracteres']
        },
        grade: {
            type: String,
            required: [true, 'El grado del estudiante es requerido'],
            enum: {
                values: ['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'],
                message: 'Grado no válido'
            }
        },
        infractions: {
            type: Number,
            default: 0
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
)

StudentSchema.index({ isActive: 1});
StudentSchema.index({ grade: 1});
StudentSchema.index({ isActive: 1, grade: 1});

export default mongoose.model('Student', StudentSchema);
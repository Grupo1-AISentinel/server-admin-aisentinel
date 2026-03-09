'use strict';

import mongoose from 'mongoose';

const alertsSchema = mongoose.Schema(
    {
        studentCard: {
            type: String,
            required: [true, 'El carnet es requerido'],
            trim: true,
            maxLength: [7, 'El carnet no puede exceder 7 caracteres']
        },
        infractionCount: {
            type: Number,
            default: 1
        },
        lastDetection: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['NOTIFICADO_ALUMNO', 'REPORTADO_A_COORDINACION'],
            default: 'NOTIFICADO_ALUMNO'
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

alertsSchema.index({ studentCard: 1 });
export default mongoose.model('Alert', alertsSchema);
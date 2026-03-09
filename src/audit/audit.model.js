'use strict';

import mongoose from 'mongoose';

const AuditSchema = mongoose.Schema(
    {
        userId: {
            type: String,
            required: [true, 'El ID del usuario es requerido']
        },
        userRole: {
            type: String,
            required: [true, 'El rol del usuario es requerido']
        },
        action: {
            type: String,
            required: [true, 'La acción es requerida']
        },
        endpoint: {
            type: String,
            required: [true, 'El endpoint modificado es requerido']
        },
        details: {
            type: Object,
            default: {}
        },
        ipAddress: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export default mongoose.model('Audit', AuditSchema);
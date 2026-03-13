'use strict';

import mongoose from 'mongoose';

const asistenciaSchema = mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true
        },
        studentCard: {
            type: String,
            required: true
        },
        checkIn: {
            type: Date,
            default: Date.now
        },
        dateStr: {
            type: String
        },
    },
    {
        timestamps: true,
        versionKey: false
    }
);

asistenciaSchema.index({ studentCard: 1 });
export default mongoose.model('Asistencia', asistenciaSchema);
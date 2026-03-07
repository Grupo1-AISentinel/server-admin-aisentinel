'use strict'

import mongoose from 'mongoose'

const inspectionSchema = new mongoose.Schema(
    {
        grade: {
            type: String,
            required: true,
            enum: ['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'],
            unique: true
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

export default mongoose.model('Inspection', inspectionSchema)
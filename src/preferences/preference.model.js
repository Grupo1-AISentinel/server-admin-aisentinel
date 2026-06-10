'use strict';

import mongoose from 'mongoose';

export const EMAIL_STRATEGIES = ['daily_report', 'per_cycle', 'disabled'];
export const REPORT_FORMATS = ['pdf', 'html'];
export const STUDENT_NOTIFY_MODES = ['first_only', 'every', 'disabled'];
export const REPORT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const preferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    role: {
      type: String,
      enum: { values: ['ADMIN_ROLE', 'COORDINATOR_ROLE'], message: 'Rol no válido' },
      required: true,
    },
    emailStrategy: {
      type: String,
      enum: { values: EMAIL_STRATEGIES, message: 'Estrategia no válida' },
      default: 'per_cycle',
    },
    reportTime: { type: String, default: '18:00' },
    reportDays: {
      type: [String],
      enum: { values: REPORT_DAYS, message: 'Día no válido' },
      default: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    },
    minInfractions: { type: Number, default: 1, min: 1 },
    reportFormat: {
      type: String,
      enum: { values: REPORT_FORMATS, message: 'Formato no válido' },
      default: 'pdf',
    },
    immediateCritical: { type: Boolean, default: true },
    immediateThreshold: { type: Number, default: 5, min: 1 },
    studentNotify: {
      type: String,
      enum: { values: STUDENT_NOTIFY_MODES, message: 'Modo de notificación a estudiante no válido' },
      default: 'first_only',
    },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('AlertPreference', preferenceSchema);

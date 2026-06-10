'use strict';

import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'CAMERA_ONLINE',
  'CAMERA_OFFLINE',
  'CONFIG_CHANGED',
  'INFRACTION_CYCLE_COMPLETED',
  'INSPECTION_STARTED',
  'INSPECTION_STOPPED',
  'PYIMAGE_ONLINE',
  'PYIMAGE_OFFLINE',
];

export const NOTIFICATION_TARGET_ROLES = ['ADMIN_ROLE', 'COORDINATOR_ROLE'];

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: { values: NOTIFICATION_TYPES, message: 'Tipo de notificación no válido' },
    },
    title: { type: String, required: true, maxLength: 120, trim: true },
    message: { type: String, required: true, maxLength: 500, trim: true },
    targetRole: {
      type: String,
      enum: { values: NOTIFICATION_TARGET_ROLES, message: 'Rol de destino no válido' },
      default: null,
    },
    targetGrade: { type: String, default: null },
    targetUserId: { type: String, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ targetRole: 1, targetGrade: 1, createdAt: -1 });
notificationSchema.index({ targetUserId: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);

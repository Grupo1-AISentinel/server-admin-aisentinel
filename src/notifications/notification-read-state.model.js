'use strict';

import mongoose from 'mongoose';

const notificationReadStateSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    lastReadAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('NotificationReadState', notificationReadStateSchema);

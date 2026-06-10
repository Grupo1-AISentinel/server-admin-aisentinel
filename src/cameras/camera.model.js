import mongoose from 'mongoose';

const sourceConfigSchema = new mongoose.Schema(
  {
    webcam: {
      index: { type: Number, default: 0 },
    },
    video: {
      path: { type: String, default: '' },
    },
    ip: {
      url: { type: String, default: '' },
    },
    wifi: {
      ssid: { type: String, default: '' },
    },
  },
  { _id: false, strict: false }
);

const cameraSchema = new mongoose.Schema(
  {
    cameraId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    location: { type: String, default: 'Sin ubicación', trim: true },
    cameraType: {
      type: String,
      enum: ['entrance', 'hallway', 'classroom', 'outdoor'],
      default: 'entrance',
    },
    grade: { type: String, default: null },
    source: {
      type: String,
      enum: ['webcam', 'video', 'ip', 'wifi'],
      default: 'webcam',
    },
    sourceConfig: {
      type: sourceConfigSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastHeartbeatAt: { type: Date, default: null },
    lastDetection: { type: Date, default: null },
    detectionsToday: { type: Number, default: 0 },
    infractionsToday: { type: Number, default: 0 },
    createdBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('Camera', cameraSchema);

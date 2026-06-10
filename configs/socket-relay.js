'use strict';

import jwt from 'jsonwebtoken';
import Camera from '../src/cameras/camera.model.js';
import Student from '../src/students/student.model.js';
import { TokenBucket } from './rate-limiter.js';
import {
  ADMIN_ROLE,
  COORDINATOR_ROLE,
  resolveCoordinatorGrade,
  canCoordinatorSeeCamera,
} from './socket-auth.js';
import { createNotification, emitRecentThrottled } from '../src/notifications/notification.controller.js';

const emitPyimageStatusNotification = async (connected) => {
  if (connected) {
    return emitRecentThrottled({
      type: 'PYIMAGE_ONLINE',
      title: 'Servicio de IA conectado',
      message: 'El motor de inteligencia artificial está en línea.',
      data: { eventId: 'pyimage' },
      target: { role: ADMIN_ROLE },
      throttleKey: 'eventId',
    });
  }
  return createNotification({
    type: 'PYIMAGE_OFFLINE',
    title: 'Servicio de IA desconectado',
    message: 'El motor de inteligencia artificial perdió conexión.',
    target: { role: ADMIN_ROLE },
  });
};

const MAX_STUDENTS_PER_FRAME = 30;
const LIVE_FRAME_BUCKET = { capacity: 5, refillPerSecond: 5 };
const METRICS_DUMP_INTERVAL_MS = 60 * 1000;

const liveFrameBucket = new TokenBucket(LIVE_FRAME_BUCKET);
const metrics = new Map();

const logInfo = (...args) => console.log('[relay]', ...args);
const logWarn = (...args) => console.warn('[relay]', ...args);

const recordMetric = (cameraId, kind) => {
  const now = Date.now();
  let entry = metrics.get(cameraId);
  if (!entry || now - entry.lastReset > METRICS_DUMP_INTERVAL_MS) {
    if (entry && entry.sent + entry.dropped > 0) {
      logInfo(
        `metrics cameraId=${cameraId} sent=${entry.sent} dropped=${entry.dropped} window=${METRICS_DUMP_INTERVAL_MS / 1000}s`
      );
    }
    entry = { sent: 0, dropped: 0, lastReset: now };
    metrics.set(cameraId, entry);
  }
  entry[kind] += 1;
};

const isJwt = (token) => typeof token === 'string' && token.split('.').length === 3;

const validateDetectionPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return 'payload no es objeto';
  if (typeof payload.cameraId !== 'string' || !payload.cameraId.trim()) {
    return 'cameraId inválido';
  }
  if (typeof payload.timestamp !== 'number' || Number.isNaN(payload.timestamp)) {
    return 'timestamp inválido';
  }
  if (!Array.isArray(payload.results)) return 'results no es array';
  if (payload.results.length > MAX_STUDENTS_PER_FRAME) {
    return `demasiados estudiantes (max ${MAX_STUDENTS_PER_FRAME})`;
  }
  return null;
};

const studentIdCards = (results) => {
  const ids = new Set();
  for (const r of results) {
    const id = r?.student_id;
    const normalized = id === null || id === undefined ? '' : String(id).trim();
    if (normalized) ids.add(normalized);
  }
  return [...ids];
};

const enrichWithStudents = async (results) => {
  const cards = studentIdCards(results);
  if (cards.length === 0) return new Map();
  const students = await Student.find({ idCard: { $in: cards }, isActive: true })
    .select('idCard studentName studentSurname grade')
    .lean();
  return new Map(students.map((s) => [String(s.idCard), s]));
};

const toLiveFrame = (payload, studentMap) => {
  const frameSize = payload.videoSize || null;
  return {
    cameraId: payload.cameraId,
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
    videoSize: frameSize,
    students: payload.results.map((r) => {
      const meta = studentMap.get(r.student_id);
      const isUnknown = !r.student_id;
      return {
        studentCard: r.student_id || null,
        studentName: meta?.studentName || null,
        studentSurname: meta?.studentSurname || null,
        grade: meta?.grade || null,
        isUnknown,
        hasUniform: typeof r.has_uniform === 'boolean' ? r.has_uniform : null,
        hasAccessory: typeof r.has_accessory === 'boolean' ? r.has_accessory : null,
        reason: isUnknown
          ? 'PERSONA_DESCONOCIDA'
          : r.has_uniform === false
            ? 'UNIFORME_INCOMPLETO'
            : r.has_accessory
              ? 'ACCESORIO_NO_PERMITIDO'
              : null,
        faceBox: Array.isArray(r.location) && r.location.length === 4
          ? { top: r.location[0], right: r.location[1], bottom: r.location[2], left: r.location[3] }
          : null,
        clothingBoxes: Array.isArray(r.clothing_boxes)
          ? r.clothing_boxes.map((c) => ({
              class: c.class || '',
              valid: Boolean(c.valid),
              box: Array.isArray(c.box) && c.box.length === 4
                ? { x1: c.box[0], y1: c.box[1], x2: c.box[2], y2: c.box[3] }
                : null,
            }))
          : [],
        videoSize: r.videoSize || frameSize,
        isNewAttendance: Boolean(r.is_new_attendance),
        tracking: r.tracking || null,
        confidence: typeof r.confidence === 'number' ? r.confidence : null,
      };
    }),
  };
};

export const setupDetectionRelay = (io) => {
  const internalKey = process.env.INTERNAL_API_KEY || process.env.INTERNAL_API_TOKEN || '';

  if (!internalKey) {
    logWarn('INTERNAL_API_KEY/INTERNAL_API_TOKEN no configurado. Las conexiones pyimage serán rechazadas.');
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (internalKey && token && token === internalKey) {
      socket.data.isPyimage = true;
      socket.data.isFrontend = false;
      return next();
    }
    if (!internalKey && token) {
      logWarn(`Conexión rechazada: INTERNAL_API_KEY no configurado (sid=${socket.id})`);
      return next(new Error('Auth requerida'));
    }
    if (token && isJwt(token)) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
        });
        socket.data.userId = decoded.sub;
        socket.data.userRole = decoded.role;
        socket.data.isPyimage = false;
        socket.data.isFrontend = true;
        return next();
      } catch (err) {
        return next(new Error('Token inválido'));
      }
    }
    return next(new Error('Auth requerida'));
  });

  io.on('connection', (socket) => {
    if (socket.data.isPyimage) {
      logInfo(`pyimage connected sid=${socket.id}`);
      io.emit('pyimage:status', { connected: true });
      emitPyimageStatusNotification(true).catch((err) =>
        logWarn(`error emitiendo notificación pyimage online: ${err.message}`)
      );
    } else {
      logInfo(`frontend connected sid=${socket.id} role=${socket.data.userRole || 'unknown'}`);
      if (socket.data.userId) {
        socket.join(`user:${socket.data.userId}`);
        if (socket.data.userRole) socket.join(`role:${socket.data.userRole}`);
      }
    }

    socket.on('pyimage:detection_results', async (payload) => {
      if (!socket.data.isPyimage) {
        logWarn(`sid=${socket.id} tried pyimage:detection_results without auth`);
        return socket.disconnect(true);
      }
      const err = validateDetectionPayload(payload);
      if (err) {
        logWarn(`invalid payload from pyimage: ${err}`);
        return;
      }

      const bucket = liveFrameBucket.tryConsume(payload.cameraId);
      if (!bucket.allowed) {
        recordMetric(payload.cameraId, 'dropped');
        return;
      }

      try {
        const studentMap = await enrichWithStudents(payload.results);
        const liveFrame = toLiveFrame(payload, studentMap);
        io.to(`camera:${payload.cameraId}`).emit('detection:live_frame', liveFrame);
        recordMetric(payload.cameraId, 'sent');
      } catch (innerErr) {
        logWarn(`error procesando frame cameraId=${payload.cameraId}: ${innerErr.message}`);
      }
    });

    socket.on('subscribe_cameras', async (data) => {
      if (!socket.data.isFrontend) return;

      if (data && Array.isArray(data.cameraIds) && data.cameraIds.length === 0) {
        const current = [...socket.rooms].filter((r) => r.startsWith('camera:'));
        for (const r of current) socket.leave(r);
        return;
      }

      let ids;
      if (data && Array.isArray(data.cameraIds)) {
        ids = data.cameraIds;
      } else {
        const filter = { isActive: true };
        if (socket.data.userRole === COORDINATOR_ROLE) {
          const grade = await resolveCoordinatorGrade(socket.data.userId);
          if (grade) filter.grade = grade;
        }
        const allCameras = await Camera.find(filter).select('cameraId').lean();
        ids = allCameras.map((c) => c.cameraId);
      }

      for (const cameraId of ids) {
        if (typeof cameraId !== 'string' || !cameraId.trim()) continue;
        const cameraDoc = await Camera.findOne({ cameraId, isActive: true })
          .select('grade cameraType')
          .lean();
        if (!cameraDoc) {
          socket.emit('camera:error', { cameraId, reason: 'NOT_FOUND' });
          continue;
        }
        if (socket.data.userRole === COORDINATOR_ROLE) {
          const grade = await resolveCoordinatorGrade(socket.data.userId);
          if (!canCoordinatorSeeCamera(grade, cameraDoc)) {
            socket.emit('camera:error', { cameraId, reason: 'FORBIDDEN' });
            continue;
          }
        }
        socket.join(`camera:${cameraId}`);
      }
    });

    socket.on('unsubscribe_cameras', (data) => {
      if (!socket.data.isFrontend) return;
      const ids = Array.isArray(data?.cameraIds) ? data.cameraIds : [];
      for (const id of ids) {
        if (typeof id === 'string' && id.trim()) socket.leave(`camera:${id}`);
      }
    });

    socket.on('disconnect', (reason) => {
      if (socket.data.isPyimage) {
        logWarn(`pyimage disconnected sid=${socket.id} reason=${reason}`);
        io.emit('pyimage:status', { connected: false });
        emitPyimageStatusNotification(false).catch((err) =>
          logWarn(`error emitiendo notificación pyimage offline: ${err.message}`)
        );
      } else {
        logInfo(`frontend disconnected sid=${socket.id} reason=${reason}`);
      }
    });

    socket.on('python_registro_completado', (data) => {
      if (socket.data.isPyimage) {
        logInfo(`IA completó procesamiento: Carnet ${data?.carnet}`);
      }
    });
  });
};

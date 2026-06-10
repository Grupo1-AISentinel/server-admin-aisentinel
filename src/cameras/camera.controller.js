import fs from 'fs';
import Camera from './camera.model.js';
import { createNotification } from '../notifications/notification.controller.js';
import { getVideoUploadDir } from '../../middlewares/video-uploader.js';
import pyimageClient from '../../utils/pyimage-client.js';
import { processAutomaticDetectionInternal } from '../alerts/alerts.controller.js';
import { io } from '../../configs/app.js';

const CAMERA_TYPES = ['entrance', 'hallway', 'classroom', 'outdoor'];
const CAMERA_SOURCES = ['webcam', 'video', 'ip', 'wifi'];
const LOCAL_SOURCES = ['webcam', 'video', 'ip'];

const frameThrottle = new Map();
// Throttle per (userId, cameraId) en ms. El frontend envia a
// FRAME_INTERVAL_MS (800ms en el uploader). 750ms deja margen
// de 50ms sobre el timestamp de INICIO del request para tolerar
// jitter del timer del navegador sin activar 429. El timestamp
// se setea al inicio del request (no al final), asi que el
// throttle mide tiempo entre requests INICIADAS (no completadas),
// que es lo que naturalmente ocurre cada FRAME_INTERVAL_MS.
//
// FIX FASE 1A: ademas del throttle, ignoramos el `last` si tiene
// mas de THROTTLE_NEW_SESSION_MS (1.5s = ~2x FRAME_INTERVAL_MS).
// Esto evita el 429 del primer request de una nueva sesion
// (reload, nueva pestana, login fresco): si el gap es >1.5s,
// asumimos que el `last` es de la sesion anterior y dejamos pasar.
const FRAME_THROTTLE_MS = 750;
const THROTTLE_NEW_SESSION_MS = 1500;

const readJpegDimensions = (buffer) => {
  if (!buffer || buffer.length < 4) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = buffer.readUInt16BE(offset);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width > 0 && height > 0) return { width, height };
    }
    offset += length;
  }
  return null;
};

const sanitizeSourceConfig = (source, raw) => {
  if (!raw || typeof raw !== 'object') return {};
  const cfg = {};
  if (source === 'webcam') {
    const rawIdx = raw.webcam?.index;
    const idx = Number.isFinite(rawIdx) ? rawIdx : parseInt(rawIdx, 10);
    cfg.webcam = { index: Number.isFinite(idx) && idx >= 0 ? idx : 0 };
  } else if (source === 'video') {
    const p = raw.video?.path;
    cfg.video = { path: typeof p === 'string' ? p.trim() : '' };
  } else if (source === 'ip') {
    const u = raw.ip?.url;
    cfg.ip = { url: typeof u === 'string' ? u.trim() : '' };
  } else if (source === 'wifi') {
    const s = raw.wifi?.ssid;
    cfg.wifi = { ssid: typeof s === 'string' ? s.trim() : '' };
  }
  return cfg;
};

export const getActiveCameras = async (req, res, next) => {
  try {
    const cameras = await Camera.find({ isActive: true })
      .sort({ status: -1, cameraId: 1 })
      .limit(50);
    res.status(200).json({ success: true, cameras });
  } catch (error) {
    next(error);
  }
};

export const listCameras = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, source, search } = req.query;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const filter = { isActive: true };
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ cameraId: re }, { name: re }, { location: re }];
    }

    const [cameras, total] = await Promise.all([
      Camera.find(filter)
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit),
      Camera.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: cameras,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit),
        totalRecords: total,
        limit: parsedLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCameraById = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Cámara no encontrada' });
    }
    res.status(200).json({ success: true, camera });
  } catch (error) {
    next(error);
  }
};

const validateCameraPayload = (body) => {
  const errors = [];
  if (!body.cameraId || !String(body.cameraId).trim()) {
    errors.push('cameraId es requerido');
  }
  if (body.source && !CAMERA_SOURCES.includes(body.source)) {
    errors.push(`source debe ser uno de: ${CAMERA_SOURCES.join(', ')}`);
  }
  if (body.cameraType && !CAMERA_TYPES.includes(body.cameraType)) {
    errors.push(`cameraType debe ser uno de: ${CAMERA_TYPES.join(', ')}`);
  }
  if (body.source === 'video' && (!body.sourceConfig?.video?.path || !body.sourceConfig.video.path.trim())) {
    errors.push('Para source=video debe indicar sourceConfig.video.path');
  }
  if (body.source === 'ip' && (!body.sourceConfig?.ip?.url || !body.sourceConfig.ip.url.trim())) {
    errors.push('Para source=ip debe indicar sourceConfig.ip.url');
  }
  return errors;
};

export const createCamera = async (req, res, next) => {
  try {
    const errors = validateCameraPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const {
      cameraId,
      name = '',
      description = '',
      location = 'Sin ubicación',
      cameraType = 'entrance',
      grade = null,
      source = 'webcam',
      sourceConfig,
    } = req.body;

    const trimmedId = cameraId.trim();
    const existing = await Camera.findOne({ cameraId: trimmedId });
    if (existing) {
      if (existing.isActive) {
        return res.status(409).json({ success: false, message: 'Ya existe una cámara activa con ese cameraId' });
      }
      existing.isActive = true;
      existing.name = String(name).trim();
      existing.description = String(description).trim();
      existing.location = String(location).trim();
      existing.cameraType = cameraType;
      existing.grade = grade;
      existing.source = source;
      existing.sourceConfig = sanitizeSourceConfig(source, sourceConfig);
      existing.createdBy = req.userId || existing.createdBy;
      if (LOCAL_SOURCES.includes(source)) {
        existing.status = 'online';
        existing.lastHeartbeatAt = new Date();
      } else {
        existing.status = existing.status || 'offline';
      }
      await existing.save();
      return res.status(200).json({
        success: true,
        camera: existing,
        message: 'Cámara reactivada',
      });
    }

    const initialStatus = LOCAL_SOURCES.includes(source) ? 'online' : 'offline';
    const camera = await Camera.create({
      cameraId: trimmedId,
      name: String(name).trim(),
      description: String(description).trim(),
      location: String(location).trim(),
      cameraType,
      grade,
      source,
      status: initialStatus,
      lastHeartbeatAt: LOCAL_SOURCES.includes(source) ? new Date() : undefined,
      sourceConfig: sanitizeSourceConfig(source, sourceConfig),
      createdBy: req.userId || null,
    });

    res.status(201).json({ success: true, camera });
  } catch (error) {
    next(error);
  }
};

export const updateCamera = async (req, res, next) => {
  try {
    const updates = {};
    const { name, description, location, cameraType, grade, source, sourceConfig, isActive } = req.body;

    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (location !== undefined) updates.location = String(location).trim();
    if (cameraType !== undefined) {
      if (!CAMERA_TYPES.includes(cameraType)) {
        return res.status(400).json({ success: false, message: `cameraType inválido` });
      }
      updates.cameraType = cameraType;
    }
    if (grade !== undefined) updates.grade = grade;
    if (source !== undefined) {
      if (!CAMERA_SOURCES.includes(source)) {
        return res.status(400).json({ success: false, message: `source inválido` });
      }
      updates.source = source;
      updates.sourceConfig = sanitizeSourceConfig(source, sourceConfig);
    } else if (sourceConfig !== undefined && req.body.source === undefined) {
      updates.sourceConfig = sanitizeSourceConfig(req.body.source || 'webcam', sourceConfig);
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const camera = await Camera.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Cámara no encontrada' });
    }
    res.status(200).json({ success: true, camera });
  } catch (error) {
    next(error);
  }
};

export const deleteCamera = async (req, res, next) => {
  try {
    const camera = await Camera.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Cámara no encontrada' });
    }
    res.status(200).json({ success: true, camera, message: 'Cámara desactivada' });
  } catch (error) {
    next(error);
  }
};

export const upsertCamera = async (req, res, next) => {
  try {
    const { cameraId, location, cameraType, grade, status, detectionsToday, infractionsToday, source, sourceConfig } = req.body;
    if (!cameraId) {
      return res.status(400).json({ success: false, message: 'cameraId es requerido' });
    }

    const update = {
      location,
      cameraType,
      grade,
      status,
      lastHeartbeatAt: new Date(),
    };
    if (source) update.source = source;
    if (sourceConfig) update.sourceConfig = sanitizeSourceConfig(source, sourceConfig);
    if (typeof detectionsToday === 'number') update.detectionsToday = detectionsToday;
    if (typeof infractionsToday === 'number') update.infractionsToday = infractionsToday;

    const previous = await Camera.findOneAndUpdate(
      { cameraId },
      { $set: update, $setOnInsert: { cameraId } },
      { new: false, upsert: true, setDefaultsOnInsert: true }
    );
    const camera = previous
      ? await Camera.findOne({ cameraId }).lean()
      : await Camera.findOne({ cameraId }).lean();
    const previousStatus = previous?.status || null;

    if (
      status &&
      (status === 'online' || status === 'offline') &&
      previousStatus !== status
    ) {
      const isOnline = status === 'online';
      const targets = [{ role: 'ADMIN_ROLE' }];
      if (camera?.grade) targets.push({ role: 'COORDINATOR_ROLE', grade: camera.grade });
      for (const t of targets) {
        await createNotification({
          type: isOnline ? 'CAMERA_ONLINE' : 'CAMERA_OFFLINE',
          title: isOnline ? 'Cámara conectada' : 'Cámara desconectada',
          message: isOnline
            ? `La cámara ${cameraId} está ahora en línea.`
            : `La cámara ${cameraId} perdió conexión.`,
          data: { cameraId, grade: camera?.grade || null },
          target: t,
        });
      }
    }

    res.status(200).json({ success: true, camera });
  } catch (error) {
    next(error);
  }
};

export const updateCameraStatus = async (req, res, next) => {
  try {
    const { cameraId } = req.params;
    const { status, lastDetection, detectionsToday, infractionsToday } = req.body;
    const update = { status };
    if (lastDetection) update.lastDetection = lastDetection;
    if (typeof detectionsToday === 'number') update.detectionsToday = detectionsToday;
    if (typeof infractionsToday === 'number') update.infractionsToday = infractionsToday;
    const camera = await Camera.findOneAndUpdate({ cameraId }, update, { new: true });
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Cámara no encontrada' });
    }
    res.status(200).json({ success: true, camera });
  } catch (error) {
    next(error);
  }
};

const listLocalVideoFiles = () => {
  const dir = getVideoUploadDir();
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(mp4|webm|avi|mkv|mov)$/i.test(f))
      .sort();
  } catch (err) {
    console.warn(`[cameras] No se pudo listar ${dir}: ${err.message}`);
    return [];
  }
};

export const listVideoAssets = async (req, res) => {
  const local = listLocalVideoFiles();
  res.status(200).json({ success: true, videos: local });
};

export const uploadCameraVideo = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });
    }
    res.status(201).json({
      success: true,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    next(err);
  }
};

const toLiveFramePayload = (cameraId, results, studentMap) => {
  const frameSize = results?.videoSize || null;
  const students = (results?.students || []).map((s) => {
    const meta = studentMap.get(s.student_id);
    const isUnknown = !s.student_id;
    return {
      studentCard: s.student_id || null,
      studentName: meta?.studentName || null,
      studentSurname: meta?.studentSurname || null,
      grade: meta?.grade || null,
      isUnknown,
      hasUniform: typeof s.has_uniform === 'boolean' ? s.has_uniform : null,
      hasAccessory: typeof s.has_accessory === 'boolean' ? s.has_accessory : null,
      reason: isUnknown
        ? 'PERSONA_DESCONOCIDA'
        : s.has_uniform === false
          ? 'UNIFORME_INCOMPLETO'
          : s.has_accessory
            ? 'ACCESORIO_NO_PERMITIDO'
            : null,
      faceBox: Array.isArray(s.location) && s.location.length === 4
        ? { top: s.location[0], right: s.location[1], bottom: s.location[2], left: s.location[3] }
        : null,
      clothingBoxes: Array.isArray(s.clothing_boxes)
        ? s.clothing_boxes.map((c) => ({
            class: c.class || '',
            valid: Boolean(c.valid),
            box: Array.isArray(c.box) && c.box.length === 4
              ? { x1: c.box[0], y1: c.box[1], x2: c.box[2], y2: c.box[3] }
              : null,
          }))
        : [],
      videoSize: s.videoSize || frameSize,
      isNewAttendance: Boolean(s.is_new_attendance),
      tracking: s.tracking || null,
      confidence: typeof s.confidence === 'number' ? s.confidence : null,
    };
  });
  return {
    cameraId,
    timestamp: new Date().toISOString(),
    videoSize: frameSize,
    students,
  };
};

const enrichStudents = async (students) => {
  if (!Array.isArray(students) || students.length === 0) return new Map();
  const Student = (await import('../students/student.model.js')).default;
  const ids = [...new Set(students.map((s) => s.student_id).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const docs = await Student.find({ idCard: { $in: ids }, isActive: true })
    .select('idCard studentName studentSurname grade')
    .lean();
  return new Map(docs.map((d) => [String(d.idCard), d]));
};

const triggerAlertIfInfraction = async (cameraId, location, students, frameBuffer) => {
  if (!Array.isArray(students)) return;
  // FIX: pasar el JPEG del frame como base64 al body del alert para
  // que el email pueda adjuntarlo. Antes `image: ''` se mandaba vacio
  // y sendSmartEmail adjuntaba un JPEG corrupto.
  const imageBase64 = frameBuffer && frameBuffer.length > 0
    ? `data:image/jpeg;base64,${frameBuffer.toString('base64')}`
    : '';
  for (const s of students) {
    if (!s.student_id) continue;
    if (s.has_uniform === false || s.has_accessory) {
      const faceBox = Array.isArray(s.location) && s.location.length === 4
        ? { top: s.location[0], right: s.location[1], bottom: s.location[2], left: s.location[3] }
        : null;
      const reason = s.has_accessory ? 'ACCESORIO_NO_PERMITIDO' : 'UNIFORME_INCOMPLETO';
      const body = {
        idCard: s.student_id,
        has_uniform: !!s.has_uniform,
        has_accessory: !!s.has_accessory,
        reason,
        image: imageBase64,
        faceBox,
        clothingBoxes: (s.clothing_boxes || []).map((c) => ({
          class: c.class,
          valid: !!c.valid,
          box: c.box
            ? { x1: c.box[0], y1: c.box[1], x2: c.box[2], y2: c.box[3] }
            : null,
        })),
        videoSize: s.videoSize || null,
        cameraId,
      };
      try {
        await processAutomaticDetectionInternal(body);
      } catch (err) {
        console.warn(`[frame-upload] alert trigger error: ${err.message}`);
      }
    }
  }
};

export const uploadFrame = async (req, res, next) => {
  try {
    const { cameraId } = req.params;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún frame' });
    }
    const camera = await Camera.findOne({ cameraId, isActive: true }).lean();
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Cámara no encontrada o inactiva' });
    }
    // Throttle namespacing por userId para que multiples pestañas
    // del mismo usuario no se pisen entre si, pero tampoco acumulen
    // cuota de otros clientes.
    // Importante: el timestamp se setea al INICIO del request (al
    // arrival del frame), NO al final. Asi el throttle mide "tiempo
    // minimo entre frames que llegan al admin", que coincide con el
    // FRAME_INTERVAL_MS del uploader (800ms). Si se setea al final,
    // el tiempo entre completions es (interval - processing), y con
    // 200ms de procesamiento de pyimage el margen se evapora y el
    // throttle salta con 429 aunque el cliente respete los 800ms.
    //
    // FIX FASE 1A: ademas del throttle, si el `last` es de hace mas
    // de THROTTLE_NEW_SESSION_MS lo ignoramos. Esto evita el 429
    // espurio del primer request de cada nueva sesion (el frameThrottle
    // Map persiste en memoria entre reloads del navegador; sin esta
    // heuristica, un reload dentro de 750ms de la sesion anterior
    // devuelve 429 aunque el cliente respete su propio intervalo).
    const throttleKey = `${req.userId || 'anon'}:${cameraId}`;
    const last = frameThrottle.get(throttleKey) || 0;
    const now = Date.now();
    const sinceLast = now - last;
    const isRecentSession = last > 0 && sinceLast < THROTTLE_NEW_SESSION_MS;
    if (isRecentSession && sinceLast < FRAME_THROTTLE_MS) {
      return res.status(429).json({ success: false, message: 'Throttle: demasiados frames' });
    }
    frameThrottle.set(throttleKey, now);

    const result = await pyimageClient.detectSingle({
      imageBuffer: req.file.buffer,
      filename: req.file.originalname || 'frame.jpg',
      cameraId,
      location: camera.location || 'unknown',
    });

    // [DIAG] Log temporal: timing del round-trip completo.
    // Activar con: AISENTINEL_DIAG=1 pnpm run dev
    if (process.env.AISENTINEL_DIAG === '1') {
      const tEnd = Date.now();
      const tPyimage = (globalThis.__diagLastPyimageTs && (tEnd - globalThis.__diagLastPyimageTs)) || '?';
      console.log(`[DIAG][frame-upload] camera=${cameraId} total=${tEnd - now}ms pyimage_ms=${tPyimage} students=${result?.students?.length || 0}`);
    }

    const students = result?.students || [];
    const studentMap = await enrichStudents(students);
    const fallbackVideoSize = result?.videoSize || readJpegDimensions(req.file.buffer) || null;
    if (fallbackVideoSize && !result?.videoSize) {
      result.videoSize = fallbackVideoSize;
    }
    const liveFrame = toLiveFramePayload(cameraId, result, studentMap);

    if (camera.status !== 'online') {
      Camera.updateOne(
        { cameraId },
        { status: 'online', lastHeartbeatAt: new Date() }
      ).catch((err) => console.warn(`[frame-upload] status update: ${err.message}`));
    }

    if (io) {
      io.to(`camera:${cameraId}`).emit('detection:live_frame', liveFrame);
    }

    if (students.length > 0) {
      triggerAlertIfInfraction(cameraId, camera.location, students, req.file.buffer).catch((err) =>
        console.warn(`[frame-upload] alert task error: ${err.message}`)
      );
    }

    res.status(200).json({ success: true, liveFrame });
  } catch (err) {
    const code = err?.code || '';
    const isConnError =
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      /connect|timeout/i.test(err?.message || '');
    if (isConnError) {
      console.error(`[frame-upload] pyimage no disponible: ${err.message}`);
      return res
        .status(503)
        .json({ success: false, message: 'Servicio de IA no disponible' });
    }
    console.error(`[frame-upload] error cameraId=${req.params.cameraId}: ${err.message}`);
    res.status(502).json({ success: false, message: 'Error al procesar frame con pyimage' });
  }
};

import multer from 'multer';
import { extname, join, resolve, basename } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const VIDEO_MIMETYPES = [
  'video/mp4',
  'video/webm',
  'video/avi',
  'video/x-matroska',
  'video/quicktime',
  'video/x-msvideo',
];

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

const resolveUploadDir = () => {
  const configured = process.env.VIDEO_UPLOAD_DIR;
  if (configured) return resolve(configured);
  return resolve(process.cwd(), 'uploads', 'camera-videos');
};

const sanitizeBaseName = (raw) => {
  const base = basename(raw, extname(raw));
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'video';
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = resolveUploadDir();
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const ext = extname(file.originalname).toLowerCase() || '.mp4';
    const safe = sanitizeBaseName(file.originalname);
    const shortUuid = uuidv4().substring(0, 6);
    cb(null, `${safe}-${shortUuid}${ext}`);
  },
});

export const uploadCameraVideo = multer({
  storage,
  fileFilter(req, file, cb) {
    if (VIDEO_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Use mp4, webm, avi o mkv.`));
    }
  },
  limits: { fileSize: MAX_VIDEO_SIZE },
});

export const getVideoUploadDir = resolveUploadDir;

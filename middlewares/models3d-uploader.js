import multer from 'multer';
import dotenv from 'dotenv';
import { extname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const VALID_MIME_TYPES = ['model/gltf-binary', 'application/octet-stream'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const UPLOAD_DIR = process.env.MODELS3D_UPLOAD_DIR
    || resolve(process.cwd(), 'uploads', 'models3d');

if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const safeName = (req.body.name || file.originalname.replace(ext, ''))
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const uniqueId = uuidv4().substring(0, 8);
        cb(null, `${safeName}-${uniqueId}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ext !== '.glb') {
        return cb(new Error('Solo se permiten archivos .glb (glTF Binary)'));
    }
    if (!VALID_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error(`Tipo MIME no permitido. Recibido: ${file.mimetype}`));
    }
    cb(null, true);
};

export const uploadModel3D = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
    },
});

export const MODELS3D_UPLOAD_DIR = UPLOAD_DIR;
export const MODELS3D_MAX_FILE_SIZE = MAX_FILE_SIZE;

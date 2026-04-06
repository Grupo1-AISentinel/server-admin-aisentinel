import multer from "multer";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const MIMETYPES = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'image/avif'
]

const MAX_FILE_SIZE = 10 * 1024 * 1024; //10MB

const createCloudinaryUploader = (folder) => {
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: (req, file) => {
            const fileExt = extname(file.originalname);
            const baseName = file.originalname.replace(fileExt, '');
            const safeBase = baseName
                .toLowerCase()
                .replace(/[^a-z0-9]+/gi, '-')
                .replace(/^-+|-+$/g, '');

            const shortUuid = uuidv4().substring(0, 8);
            const publicId = `${safeBase}-${shortUuid}`;

            return {
                folder: folder,
                public_id: publicId,
                allowed_formats: ['jpeg', 'jpg', 'png', 'webp', 'avif'],
                transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
                resource_type: 'image'
            }
        }
    })

    return multer({
        storage: storage,
        fileFilter: (req, file, cb) => {
            if (MIMETYPES.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`Solo se permiten imágenes: ${MIMETYPES.join(', ')}`));
            }
        },
        limits: {
            fileSize: MAX_FILE_SIZE
        }
    })
}

export const uploadUniformImage = createCloudinaryUploader(
    process.env.CLOUDINARY_FOLDER_UNIFORMS || 'AISentinel/uniforms'
)

export { cloudinary }
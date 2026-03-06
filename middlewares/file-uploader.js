import multer from "multer";
import dotenv from 'dotenv';

dotenv.config();

const MIMETYPES = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'image/avif'
]
    
const MAX_FILE_SIZE = 10 * 1024 * 1024; //10MB

const createUploader = () => {
    return multer({
        storage: multer.memoryStorage(),
        fileFilter: (req, file, cb) => {
            if(MIMETYPES.includes(file.mimetype)){
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

export const uploadStudentImage = createUploader();

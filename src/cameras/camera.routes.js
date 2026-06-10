import { Router } from 'express';
import multer from 'multer';
import {
  getActiveCameras,
  listCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  upsertCamera,
  updateCameraStatus,
  listVideoAssets,
  uploadCameraVideo,
  uploadFrame,
} from './camera.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdmin, validateAdminOrCoordinator } from '../../middlewares/validate-role.js';
import { validateInternalToken } from '../../middlewares/validate-internal-token.js';
import { uploadCameraVideo as uploadCameraVideoMw } from '../../middlewares/video-uploader.js';
import { frameUploadLimit } from '../../middlewares/request-limit.js';

const router = Router();

const frameUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Aceptar cualquier image/* (jpeg, jpg, png, webp) y tambien octet-stream
    // porque algunos navegadores mandan el blob de canvas con mimetype vacio
    // y multer lo infiere como application/octet-stream. La validacion real
    // del contenido JPEG la hace pyimage al decodificar.
    if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) return cb(null, true);
    if (file.mimetype === 'application/octet-stream') return cb(null, true);
    cb(new Error('Tipo de archivo no soportado (solo JPEG/PNG/WebP)'));
  },
});

router.get('/get', validateJWT, validateAdminOrCoordinator, listCameras);
router.get('/active', validateJWT, validateAdminOrCoordinator, getActiveCameras);
router.get('/videos', validateJWT, validateAdminOrCoordinator, listVideoAssets);
router.get('/internal/list', validateInternalToken, listCameras);
router.get('/:id', validateJWT, validateAdminOrCoordinator, getCameraById);

router.post(
  '/upload-video',
  validateJWT,
  validateAdmin,
  uploadCameraVideoMw.single('video'),
  uploadCameraVideo
);
router.post(
  '/:cameraId/frame',
  validateJWT,
  validateAdminOrCoordinator,
  frameUploadLimit,
  frameUpload.single('frame'),
  uploadFrame
);
router.post('/create', validateJWT, validateAdmin, createCamera);
router.put('/:id', validateJWT, validateAdmin, updateCamera);
router.delete('/:id', validateJWT, validateAdmin, deleteCamera);

router.post('/upsert', validateInternalToken, upsertCamera);
router.patch('/:cameraId/status', validateInternalToken, updateCameraStatus);

export default router;

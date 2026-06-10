'use strict';

import { Router } from 'express';
import multer from 'multer';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdmin } from '../../middlewares/validate-role.js';
import { frameUploadLimit } from '../../middlewares/request-limit.js';
import pyimageClient from '../../utils/pyimage-client.js';

const router = Router();

const testUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo no soportado: ${file.mimetype}`));
  },
});

router.get('/pyimage-status', validateJWT, (req, res) => {
  const monitor = req.app.get('pyimageMonitor');
  if (!monitor) {
    return res.status(503).json({
      success: false,
      connected: false,
      message: 'Monitor de pyimage no inicializado',
    });
  }
  return res.status(200).json({
    success: true,
    ...monitor.getStatus(),
  });
});

router.get('/chroma-status', validateJWT, async (req, res) => {
  try {
    const r = await pyimageClient.chromaStatus();
    return res.status(200).json({ success: true, ...r });
  } catch (e) {
    return res.status(503).json({ success: false, message: e.message });
  }
});

const detectReason = (student) => {
  if (!student.student_id) return 'PERSONA_DESCONOCIDA';
  if (student.has_accessory) return 'ACCESORIO_NO_PERMITIDO';
  if (student.has_uniform === false) return 'UNIFORME_INCOMPLETO';
  return null;
};

router.post(
  '/test-detection',
  validateJWT,
  validateAdmin,
  frameUploadLimit,
  testUpload.array('images', 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No se recibieron imágenes' });
      }
      const mode = req.query.mode === 'full' ? 'full' : 'clothing';

      const images = req.files.map((f) => ({
        buffer: f.buffer,
        filename: f.originalname,
        contentType: f.mimetype,
      }));

      const result = await pyimageClient.detectBatch({ images, cameraId: 'test', location: 'test' });
      const pyimageResults = Array.isArray(result?.results) ? result.results : [];
      // Liberar buffers ASAP para no sostener la imagen completa en memoria
      // durante todo el ciclo de vida de la respuesta.
      images.forEach((img) => {
        if (img?.buffer) img.buffer = null;
      });

      const responseResults = req.files.map((file, i) => {
        const pyres = pyimageResults[i];
        const students = Array.isArray(pyres?.students) ? pyres.students : [];
        const detections = students.map((s) => {
          // FIX: cuando el modo es 'clothing', NO mostramos identidad.
          // Limpiamos student_id, studentName, confidence, reason
          // (excepto PERDONA/UNIFORME) para que el render muestre la cara
          // con la mascara de "Desconocido" y SOLO evalue ropa.
          // pyimage sigue ejecutando la busqueda en ChromaDB, pero
          // descartamos los resultados aqui. En una iteracion futura se
          // puede agregar un parametro `inspect_only` al endpoint pyimage
          // para saltarse esa busqueda (~30% mas rapido por imagen).
          const isClothingOnly = mode === 'clothing';
          return {
            studentId: isClothingOnly ? null : s.student_id || null,
            studentName: isClothingOnly ? null : null,
            studentSurname: isClothingOnly ? null : null,
            grade: isClothingOnly ? null : null,
            isUnknown: isClothingOnly ? true : !s.student_id,
            hasUniform: typeof s.has_uniform === 'boolean' ? s.has_uniform : null,
            hasAccessory: typeof s.has_accessory === 'boolean' ? s.has_accessory : null,
            reason: isClothingOnly
              ? (s.has_accessory
                  ? 'ACCESORIO_NO_PERMITIDO'
                  : s.has_uniform === false
                    ? 'UNIFORME_INCOMPLETO'
                    : null)
              : detectReason(s),
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
            videoSize: s.videoSize || pyres?.videoSize || null,
            confidence: isClothingOnly ? null : (typeof s.confidence === 'number' ? s.confidence : null),
          };
        });

        return {
          imageIndex: i,
          imageName: file.originalname,
          status: pyres?.status || 'Sin resultado',
          detections,
        };
      });

      return res.status(200).json({
        success: true,
        mode,
        totalImages: req.files.length,
        results: responseResults,
      });
    } catch (err) {
      console.error(`[test-detection] error: ${err.message}`);
      return res.status(502).json({
        success: false,
        message: `Error al procesar con pyimage: ${err.message}`,
      });
    }
  }
);

export default router;

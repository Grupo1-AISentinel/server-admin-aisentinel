'use strict';

import FormData from 'form-data';
import axios from 'axios';

const PYTHON_URL = process.env.PYTHON_SERVER_URL || 'http://localhost:8000';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';
const DEFAULT_TIMEOUT_MS = 30000;
const BATCH_TIMEOUT_MS = 60000;

const postForm = async (path, form, timeout = DEFAULT_TIMEOUT_MS, signal) => {
  const response = await axios.post(`${PYTHON_URL}${path}`, form, {
    headers: {
      ...form.getHeaders(),
      'x-internal-api-key': INTERNAL_KEY,
    },
    timeout,
    signal,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return response.data;
};

const postJson = async (path, body, timeout = DEFAULT_TIMEOUT_MS, signal) => {
  const response = await axios.post(`${PYTHON_URL}${path}`, body, {
    headers: { 'x-internal-api-key': INTERNAL_KEY },
    timeout,
    signal,
  });
  return response.data;
};

const photoToBase64 = (photo) => {
  if (!photo) return null;
  if (photo.base64) return photo.base64;
  if (photo.buffer) {
    return `data:${photo.mimetype || 'image/jpeg'};base64,${photo.buffer.toString('base64')}`;
  }
  return null;
};

export const pyimageClient = {
  async detectSingle({
    imageBuffer,
    filename = 'frame.jpg',
    cameraId = 'unknown',
    location = 'unknown',
    timeout = DEFAULT_TIMEOUT_MS,
    signal,
  }) {
    const form = new FormData();
    form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });
    form.append('camera_id', cameraId);
    form.append('location', location);
    return postForm('/api/detect', form, timeout, signal);
  },

  async detectBatch({ images, cameraId = 'batch', location = 'batch', timeout = BATCH_TIMEOUT_MS, signal }) {
    if (!Array.isArray(images) || images.length === 0) {
      return { status: 'Sin imágenes', results: [] };
    }
    const form = new FormData();
    images.forEach((img, i) => {
      form.append('files', img.buffer, {
        filename: img.filename || `image-${i}.jpg`,
        contentType: img.contentType || 'image/jpeg',
      });
    });
    form.append('camera_id', cameraId);
    form.append('location', location);
    return postForm('/api/detect/batch', form, timeout, signal);
  },

  async chromaStatus() {
    return postJson('/chroma-status', {});
  },

  /**
   * Decora un JPEG con bboxes/labels sobre la imagen usando el modulo
   * draw_bboxes.py de pyimage. Retorna el JPEG anotado como Buffer.
   *
   * @param {Object} params
   * @param {Buffer} params.imageBuffer - JPEG original (sin anotar)
   * @param {Array}  params.students    - Lista de detecciones (mismo shape
   *                                       que retorna /api/detect)
   * @param {string} [params.filename]
   * @param {number} [params.timeout]
   * @returns {Promise<Buffer>} JPEG anotado
   */
  async annotateImage({ imageBuffer, students, filename = 'frame.jpg', timeout = 10000 }) {
    const form = new FormData();
    form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });
    // pyimage espera el JSON de students como string en un campo de form
    // (multipart no soporta objetos nativos).
    form.append('students', JSON.stringify(students || []));
    const response = await axios.post(`${PYTHON_URL}/api/annotate`, form, {
      headers: {
        ...form.getHeaders(),
        'x-internal-api-key': INTERNAL_KEY,
      },
      timeout,
      responseType: 'arraybuffer',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return Buffer.from(response.data);
  },

  async registerStudent({ carnet, nombre, fotos = [] }) {
    const fotos_b64 = fotos
      .map(photoToBase64)
      .filter((b) => b !== null);
    return postJson('/api/students/register', { carnet, nombre, fotos: fotos_b64 });
  },

  /**
   * Registra una prenda de uniforme. Las imagenes son paths o buffers leidos
   * por el caller. Las convertimos a base64 data URI para que pyimage
   * (/register/uniform) las decodifique (soporta data:image/...;base64,XXX).
   *
   * Mapea el enum del admin (JACKET, TSHIRT, PANTS) al enum interno de
   * pyimage (jacket, shirt, pants) porque el engine de pyimage usa nombres
   * logicos en minuscula.
   */
  async registerUniform({ itemId, itemType, imagePaths = [], extraMeta = null }) {
    const fs = await import('fs');
    const typeMap = { TSHIRT: 'shirt', JACKET: 'jacket', PANTS: 'pants', SHIRT: 'shirt' };
    const internalType = typeMap[(itemType || '').toUpperCase()] || (itemType || '').toLowerCase();
    const images_b64 = [];
    for (const p of imagePaths) {
      try {
        const buf = fs.readFileSync(p);
        const b64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
        images_b64.push(b64);
      } catch (e) {
        console.warn(`[pyimage-client] no se pudo leer ${p}: ${e.message}`);
      }
    }
    return postJson('/register/uniform', {
      item_id: itemId,
      item_type: internalType,
      images: images_b64,
    });
  },
};

export default pyimageClient;

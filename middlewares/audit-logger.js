import Audit from '../src/audit/audit.model.js';
import { createNotification } from '../src/notifications/notification.controller.js';

const NOTIFIABLE_PREFIXES = [
  '/AISentinelAdmin/v1/students',
  '/AISentinelAdmin/v1/coordinators',
  '/AISentinelAdmin/v1/uniforms',
  '/AISentinelAdmin/v1/cameras',
];

const shouldNotify = (method, url) => {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return false;
  if (url.includes('/notifications/')) return false;
  if (url.includes('/alerts/automatic-detection')) return false;
  if (url.includes('/attendance/automatic-detection')) return false;
  if (url.includes('/inspections/toggle')) return false;
  return NOTIFIABLE_PREFIXES.some((p) => url.startsWith(p));
};

const summarizeEndpoint = (url) => {
  const cleaned = url.split('?')[0].replace(/^\/AISentinelAdmin\/v1\//, '');
  const parts = cleaned.split('/').filter(Boolean);
  return parts[0] || 'recurso';
};

// Los frames de camara llegan ~1.25/s por camara de forma continua;
// auditarlos genera millones de documentos diarios sin valor (el body
// multipart no deja details utiles) y presiona la misma DB del hot path.
const FRAME_UPLOAD_REGEX = /^\/AISentinelAdmin\/v1\/cameras\/[^/]+\/frame(\?|$)/;

export const auditLogger = (req, res, next) => {
    res.on('finish', async () => {
        const modificadores = ['POST', 'PUT', 'DELETE', 'PATCH'];

        if (FRAME_UPLOAD_REGEX.test(req.originalUrl)) return;

        if (res.statusCode >= 200 && res.statusCode < 300 && modificadores.includes(req.method)) {
            try {
                const details = { ...req.body };
                if (details.password) delete details.password;

                const log = new Audit({
                    userId: req.userId || 'Sistema',
                    userRole: req.userRole || 'Sistema',
                    action: req.method,
                    endpoint: req.originalUrl,
                    details: details,
                    ipAddress: req.ip || req.connection?.remoteAddress
                });

                await log.save();

                if (shouldNotify(req.method, req.originalUrl)) {
                    const resource = summarizeEndpoint(req.originalUrl);
                    const actionLabel = { POST: 'creó', PUT: 'actualizó', PATCH: 'modificó', DELETE: 'eliminó' }[req.method] || 'modificó';
                    await createNotification({
                        type: 'CONFIG_CHANGED',
                        title: 'Cambio de configuración',
                        message: `Se ${actionLabel} un(a) ${resource}.`,
                        data: { endpoint: req.originalUrl, action: req.method, resource },
                        target: { role: 'ADMIN_ROLE' },
                    });
                }
            } catch (error) {
                console.error('Error al guardar la bitácora de auditoría:', error.message);
            }
        }
    });

    next();
};

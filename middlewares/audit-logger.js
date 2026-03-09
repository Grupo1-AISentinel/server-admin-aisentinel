import Audit from '../src/audit/audit.model.js';

export const auditLogger = (req, res, next) => {
    res.on('finish', async () => {
        const modificadores = ['POST', 'PUT', 'DELETE', 'PATCH'];
        
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
            } catch (error) {
                console.error('Error al guardar la bitácora de auditoría:', error.message);
            }
        }
    });

    next();
};
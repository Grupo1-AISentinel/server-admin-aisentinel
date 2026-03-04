import jwt from 'jsonwebtoken';

/**
 * Middleware para validar el JWT emitido por el authservice.
 * Extrae userId y role del token y los agrega al request.
 */
export const validateJWT = (req, res, next) => {
    try {
        let token =
            req.header('x-token') ||
            req.header('authorization') ||
            req.body?.token ||
            req.query.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No hay token en la petición',
            });
        }

        token = token.replace(/^Bearer\s+/, '');

        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            issuer: process.env.JWT_ISSUER,
            audience: process.env.JWT_AUDIENCE,
        });

        req.userId = decoded.sub;
        req.userRole = decoded.role;

        next();
    } catch (error) {
        let message = 'Token inválido';
        if (error.name === 'TokenExpiredError') message = 'Token expirado';
        if (error.name === 'JsonWebTokenError') message = 'Token inválido';

        return res.status(401).json({
            success: false,
            message,
        });
    }
};

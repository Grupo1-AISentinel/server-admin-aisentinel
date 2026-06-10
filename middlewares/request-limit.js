import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isInternalRequest = (req) => {
    const token =
        req.header('x-internal-token') || req.header('x-internal-api-key');
    return Boolean(token && token === process.env.INTERNAL_API_TOKEN);
};

const parsePositiveInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const requestWindowMs = parsePositiveInt(
    process.env.RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
);
const requestMax = parsePositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 600);

const autoDetectionWindowMs = parsePositiveInt(
    process.env.RATE_LIMIT_AUTODETECTION_WINDOW_MS,
    15 * 60 * 1000
);
const autoDetectionMax = parsePositiveInt(
    process.env.RATE_LIMIT_AUTODETECTION_MAX_REQUESTS,
    3000
);

export const requestLimit = rateLimit({
    windowMs: requestWindowMs,
    max: requestMax,
    skip: isInternalRequest,
    message: {
        success: false,
        message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.',
        error: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
        res.status(429).json({
            success: false,
            message:
                'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.round((req.rateLimit.resetTime - Date.now()) / 1000),
        });
    },
});

export const autoDetectionLimit = rateLimit({
    windowMs: autoDetectionWindowMs,
    max: autoDetectionMax,
    skip: isInternalRequest,
    message: {
        success: false,
        message:
            'Demasiadas peticiones de detección automática, intenta de nuevo más tarde.',
        error: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(
            `Auto-detection rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`
        );
        res.status(429).json({
            success: false,
            message:
                'Demasiadas peticiones de detección automática, intenta de nuevo más tarde.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.round((req.rateLimit.resetTime - Date.now()) / 1000),
        });
    },
});

const frameUploadWindowMs = parsePositiveInt(
    process.env.RATE_LIMIT_FRAME_WINDOW_MS,
    60 * 1000
);
const frameUploadMax = parsePositiveInt(process.env.RATE_LIMIT_FRAME_MAX_REQUESTS, 3000);

export const frameUploadLimit = rateLimit({
    windowMs: frameUploadWindowMs,
    max: frameUploadMax,
    keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
    skip: isInternalRequest,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Demasiados frames subidos. Reduzca la frecuencia.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.round((req.rateLimit.resetTime - Date.now()) / 1000),
        });
    },
});

export const validateInternalToken = (req, res, next) => {
  const token = req.header('x-internal-token') || req.header('x-internal-api-key');
  if (!token || token !== process.env.INTERNAL_API_TOKEN) {
    return res.status(401).json({
      success: false,
      message: 'Token interno requerido.',
      error: 'UNAUTHORIZED',
    });
  }
  next();
};

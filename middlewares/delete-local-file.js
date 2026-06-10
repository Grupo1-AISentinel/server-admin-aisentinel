import { unlink } from 'fs/promises';

export const cleanLocalFileOnFinish = (req, res, next) => {
    if (req.file) {
        res.on('finish', async () => {
            if (res.statusCode >= 400) {
                try {
                    await unlink(req.file.path);
                    console.log(
                        `Archivo local eliminado por respuesta ${res.statusCode}: ${req.file.path}`
                    );
                } catch (error) {
                    console.error(
                        `Error al eliminar archivo local tras respuesta de error: ${error.message}`
                    );
                }
            }
        });
    }
    next();
};

export const deleteLocalFileOnError = async (err, req, res, next) => {
    if (req.file) {
        try {
            await unlink(req.file.path);
            console.log(
                `Archivo local eliminado por error en cadena: ${req.file.path}`
            );
        } catch (error) {
            console.error(
                `Error al eliminar archivo local (error handler): ${error.message}`
            );
        }
    }
    return next(err);
};

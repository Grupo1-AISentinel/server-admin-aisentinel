import Uniform from './uniform.model.js';
import cloudinary from '../../configs/cloudinary.js';
const pickBestImage = (files) =>
    files.reduce((best, current) =>
        current.size > best.size ? current : best
    );

export const createUniform = async (req, res) => {
    try {

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren al menos 3 imagenes para generar el embedding del uniforme',
            });
        }

        const firstImage = req.files[0];
        const base64Image = Buffer.from(firstImage.buffer).toString('base64');
        const dataUri = `data:${firstImage.mimetype};base64,${base64Image}`;

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder: 'AISentinel/uniforms',
            public_id: `${req.body.name.replace(/\s+/g, '_')}_initial`,
            overwrite: true,
            resource_type: 'image'
        });

        const uniformData = {
            ...req.body,
            imageUrl: uploadResult.secure_url,
            public_id: uploadResult.public_id,
        };
        const uniform = new Uniform(uniformData);
        await uniform.save();

        const io = req.app.get('socketio');
        io.emit('enviar_uniforme_a_python', {
            nombre: req.body.name,
            tipo: req.body.type,
            fotos: req.files.map((file) => ({
                buffer: file.buffer,
                mimetype: file.mimetype,
            })),
        });

        res.status(201).json({
            success: true,
            message: 'Uniforme creado exitosamente. Python generara el embedding.',
            data: uniform,
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al crear el uniforme',
            error: error.message,
        });
    }
};

export const getUniforms = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, isActive, type } = req.query;

        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);
        const filter = {};

        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (type) filter.type = type;

        const uniforms = await Uniform.find(filter)
            .select('-public_id')
            .limit(parsedLimit)
            .skip((parsedPage - 1) * parsedLimit)
            .sort({ createdAt: -1 });

        const total = await Uniform.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: uniforms,
            pagination: {
                currentPage: parsedPage,
                totalPages: Math.ceil(total / parsedLimit),
                totalRecords: total,
                limit: parsedLimit
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getUniformByName = async (req, res, next) => {
    try {
        const { name } = req.params;

        const uniform = await Uniform.findOne({ name });
        if (!uniform) {
            return res.status(404).json({
                success: false,
                message: 'Uniforme no encontrado'
            });
        }

        const thumbnailUrl = uniform.imageUrl;

        res.status(200).json({
            success: true,
            data: {
                _id: uniform._id,
                name: uniform.name,
                type: uniform.type,
                isActive: uniform.isActive,
                createdAt: uniform.createdAt,
                updatedAt: uniform.updatedAt,
                imageUrl: uniform.imageUrl,
                thumbnailUrl
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getUniformThumbnail = async (req, res, next) => {
    try {
        const { name } = req.params;
        const uniform = await Uniform.findOne({ name }).select('imageUrl');

        if (!uniform || !uniform.imageUrl) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada' });
        }

        return res.redirect(uniform.imageUrl);
    } catch (error) {
        next(error);
    }
};

export const updateUniform = async (req, res, next) => {
    try {
        const { name } = req.params;

        const uniform = await Uniform.findOne({ name });
        if (!uniform) {
            return res.status(404).json({
                success: false,
                message: 'Uniforme no encontrado'
            });
        }

        if (!req.files || req.files.length < 1) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere al menos 1 imagen para actualizar el uniforme'
            });
        }

        const updateData = {};
        if (req.body.type) updateData.type = req.body.type;
        if (req.body.name) updateData.name = req.body.name;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Debes enviar al menos name o type junto con las imágenes'
            });
        }

        const firstImage = req.files[0];
        const base64Image = Buffer.from(firstImage.buffer).toString('base64');
        const dataUri = `data:${firstImage.mimetype};base64,${base64Image}`;

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder: 'AISentinel/uniforms',
            public_id: `${(req.body.name ?? name).replace(/\s+/g, '_')}_initial`,
            overwrite: true,
            resource_type: 'image'
        });

        updateData.imageUrl = uploadResult.secure_url;
        updateData.public_id = uploadResult.public_id;

        const io = req.app.get('socketio');
        io.emit('enviar_uniforme_a_python', {
            nombre: req.body.name ?? name,
            tipo: req.body.type ?? uniform.type,
            fotos: req.files.map(file => ({
                buffer: file.buffer,
                mimetype: file.mimetype
            }))
        });

        const updated = await Uniform.findOneAndUpdate({ name }, updateData, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            message: 'Uniforme actualizado exitosamente. Python regenerará el recorte YOLO.',
            data: {
                _id: updated._id,
                name: updated.name,
                type: updated.type,
                isActive: updated.isActive,
                updatedAt: updated.updatedAt,
                imageUrl: updated.imageUrl
            }
        });
    } catch (error) {
        next(error);
    }
};

export const activateUniform = async (req, res, next) => {
    try {
        const { name } = req.params;
        const uniform = await Uniform.findOneAndUpdate(
            { name },
            { isActive: true },
            { new: true }
        );
        if (!uniform) return res.status(404).json({ success: false, message: 'Uniforme no encontrado' });
        res.status(200).json({ success: true, message: 'Uniforme activado exitosamente', data: { name: uniform.name, isActive: uniform.isActive } });
    } catch (error) { next(error); }
};

export const deactivateUniform = async (req, res, next) => {
    try {
        const { name } = req.params;
        const uniform = await Uniform.findOneAndUpdate(
            { name },
            { isActive: false },
            { new: true }
        );
        if (!uniform) return res.status(404).json({ success: false, message: 'Uniforme no encontrado' });
        res.status(200).json({ success: true, message: 'Uniforme desactivado exitosamente', data: { name: uniform.name, isActive: uniform.isActive } });
    } catch (error) { next(error); }
};

export const seederUniforms = async (req, res, next) => {
    try {

        const uniformData = req.body;

        if (req.file) {
            uniformData.photo = req.file.path;
        }

        const uniform = new Uniform(uniformData);
        await uniform.save();

        res.status(201).json({
            success: true,
            message: 'Uniforme creado exitosamente',
            data: uniform
        })

    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al crear el uniforme',
            error: error.message
        })
    }
};

/**
 * Crea multiples uniformes de una sola vez (usado por helpers/seed-assets.js).
 * Body (JSON): { uniforms: [{ name, type, imagePaths: [absPath1, ...], estado?, marca? }] }
 * Auth: x-internal-token (no JWT, no rol).
 *
 * Por cada uniforme: crea en Mongo (Uniform) con la primera imagen como
 * photo principal. Skip silencioso si el name ya existe.
 *
 * NOTA: el embedding en ChromaDB de pyimage se genera via el flujo normal
 * (UI /uniforms/create + socket hacia el cliente). El seeder automatico
 * solo garantiza que el catalogo este en Mongo, sincronizado con los
 * assets. El embedding se materializa cuando el usuario usa la UI para
 * ver/recrear el uniforme (boton "recalcular embedding" en el panel).
 */
export const createUniformsBulk = async (req, res, next) => {
    try {
        const fs = await import('fs');
        const { default: pyimageClient } = await import('../../utils/pyimage-client.js');
        const uniforms = Array.isArray(req.body?.uniforms) ? req.body.uniforms : [];
        const results = { created: 0, skipped: 0, embeddings: 0, failed: 0, errors: [] };

        for (const u of uniforms) {
            try {
                if (!u.name || !u.type) {
                    results.failed += 1;
                    results.errors.push({ name: u.name, error: 'name y type son requeridos' });
                    continue;
                }
                const imagePaths = Array.isArray(u.imagePaths) ? u.imagePaths : [];
                if (imagePaths.length < 1) {
                    results.failed += 1;
                    results.errors.push({ name: u.name, error: 'se requiere al menos 1 imagen' });
                    continue;
                }
                if (!fs.existsSync(imagePaths[0])) {
                    results.failed += 1;
                    results.errors.push({ name: u.name, error: `imagen no existe: ${imagePaths[0]}` });
                    continue;
                }

                let uniform = await Uniform.findOne({ name: u.name });
                if (!uniform) {
                    uniform = await Uniform.create({
                        name: u.name,
                        type: (u.type || '').toUpperCase(),
                        photo: imagePaths[0],
                        imageUrl: null,
                        public_id: null,
                        isActive: true,
                    });
                    results.created += 1;
                } else {
                    results.skipped += 1;
                }

                // Generar embeddings en ChromaDB (pyimage). Si ya existian, el
                // upsert los actualiza con los mismos id (no duplica).
                try {
                    const r = await pyimageClient.registerUniform({
                        itemId: u.name,
                        itemType: (u.type || '').toUpperCase(),
                        imagePaths,
                    });
                    if (r && !r.error) results.embeddings += 1;
                } catch (pyErr) {
                    console.warn(`[uniforms-bulk] pyimage fallo para ${u.name}: ${pyErr.message}`);
                }
            } catch (e) {
                results.failed += 1;
                results.errors.push({ name: u.name, error: e.message });
            }
        }

        res.status(200).json({ success: true, ...results });
    } catch (error) {
        next(error);
    }
};

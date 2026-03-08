import Uniform from './uniform.model.js';

const pickBestImage = (files) =>
    files.reduce((best, current) =>
        current.size > best.size ? current : best
    );

export const createUniform = async (req, res, next) => {
    try {
        const { name, type } = req.body;

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren al menos 3 imágenes para el uniforme',
            });
        }

        const existing = await Uniform.findOne({ name });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un uniforme con ese nombre',
            });
        }

        const bestImage = pickBestImage(req.files);

        const uniform = new Uniform({
            name,
            type,
            thumbnail: {
                data: bestImage.buffer,
                mimetype: bestImage.mimetype
            }
        });

        await uniform.save();

        const io = req.app.get('socketio');
        io.emit('enviar_uniforme_a_python', {
            nombre: name,
            tipo: type,
            fotos: req.files.map(file => ({
                buffer: file.buffer,
                mimetype: file.mimetype
            }))
        });

        res.status(201).json({
            success: true,
            message: 'Uniforme creado exitosamente',
            data: {
                _id: uniform._id,
                name: uniform.name,
                type: uniform.type,
                isActive: uniform.isActive,
                createdAt: uniform.createdAt
            }
        });
    } catch (error) {
        next(error);
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
            .select('-thumbnail.data')
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

        const thumbnailUrl = `/AISentinelAdmin/v1/uniforms/${encodeURIComponent(uniform.name)}/thumbnail`;

        res.status(200).json({
            success: true,
            data: {
                _id: uniform._id,
                name: uniform.name,
                type: uniform.type,
                isActive: uniform.isActive,
                createdAt: uniform.createdAt,
                updatedAt: uniform.updatedAt,
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
        const uniform = await Uniform.findOne({ name }).select('thumbnail name');

        if (!uniform) {
            return res.status(404).json({ success: false, message: 'Uniforme no encontrado' });
        }

        res.setHeader('Content-Type', uniform.thumbnail.mimetype);
        res.setHeader('Content-Disposition', `inline; filename="${uniform.name}"`);
        return res.status(200).send(uniform.thumbnail.data);
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

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren al menos 3 imágenes para actualizar el uniforme'
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

        const bestImage = pickBestImage(req.files);
        updateData.thumbnail = {
            data: bestImage.buffer,
            mimetype: bestImage.mimetype
        };

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
            message: 'Uniforme actualizado exitosamente',
            data: {
                _id: updated._id,
                name: updated.name,
                type: updated.type,
                isActive: updated.isActive,
                updatedAt: updated.updatedAt
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

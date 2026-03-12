import Uniform from './uniform.model.js';
import cloudinary from '../../configs/cloudinary.js';

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

        // Subir una imagen cualquiera como thumbnail inicial (luego Python lo actualizará con el recorte YOLO)
        const firstImage = req.files[0];
        
        // Convertir buffer a base64 para Cloudinary
        const base64Image = Buffer.from(firstImage.buffer).toString('base64');
        const dataUri = `data:${firstImage.mimetype};base64,${base64Image}`;

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder: 'AISentinel/uniforms',
            public_id: `${name.replace(/\s+/g, '_')}_initial`,
            overwrite: true,
            resource_type: 'image'
        });

        const uniform = new Uniform({
            name,
            type,
            imageUrl: uploadResult.secure_url,
            public_id: uploadResult.public_id
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
            message: 'Uniforme creado exitosamente. Python generará el recorte YOLO.',
            data: {
                _id: uniform._id,
                name: uniform.name,
                type: uniform.type,
                isActive: uniform.isActive,
                createdAt: uniform.createdAt,
                imageUrl: uniform.imageUrl
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

export const autoSyncUniform = async (req, res, next) => {
    try {
        const { name, type, thumbnail } = req.body;

        // Subir el recorte YOLO desde Python a Cloudinary
        const dataUri = `data:${thumbnail.mimetype};base64,${thumbnail.data}`;

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder: 'AISentinel/uniforms',
            public_id: name.replace(/\s+/g, '_'), // El recorte YOLO final no lleva el sufijo '_initial'
            overwrite: true,
            resource_type: 'image'
        });

        const thumbnailData = {
            imageUrl: uploadResult.secure_url,
            public_id: uploadResult.public_id
        };

        const existing = await Uniform.findOne({ name });

        if (existing) {
            const updated = await Uniform.findOneAndUpdate(
                { name },
                { type, ...thumbnailData },
                { new: true, runValidators: true }
            );

            return res.status(200).json({
                success: true,
                message: 'Uniforme actualizado con recorte YOLO sincronizado',
                data: {
                    _id: updated._id,
                    name: updated.name,
                    type: updated.type,
                    isActive: updated.isActive,
                    updatedAt: updated.updatedAt,
                    imageUrl: updated.imageUrl
                }
            });
        }

        const uniform = new Uniform({
            name,
            type,
            ...thumbnailData
        });

        await uniform.save();

        res.status(201).json({
            success: true,
            message: 'Uniforme creado con recorte YOLO sincronizado',
            data: {
                _id: uniform._id,
                name: uniform.name,
                type: uniform.type,
                isActive: uniform.isActive,
                createdAt: uniform.createdAt,
                imageUrl: uniform.imageUrl
            }
        });
    } catch (error) {
        next(error);
    }
};

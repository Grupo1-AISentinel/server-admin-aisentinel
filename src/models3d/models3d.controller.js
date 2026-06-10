import { unlink } from 'fs/promises';
import Model3D from './models3d.model.js';
import { MODELS3D_UPLOAD_DIR } from '../../middlewares/models3d-uploader.js';

const buildPublicUrl = (req, filename) => {
    const proto = req.protocol;
    const host = req.get('host');
    return `${proto}://${host}/AISentinelAdmin/v1/models3d/files/${filename}`;
};

export const createModel3D = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere el archivo .glb',
            });
        }

        const { name, displayName, slot, era } = req.body;
        const normalizedName = name.toLowerCase();

        const filePath = buildPublicUrl(req, req.file.filename);

        const model3d = new Model3D({
            name: normalizedName,
            display_name: displayName,
            slot,
            era: era || null,
            file_path: filePath,
            file_size: req.file.size,
            uploaded_by: req.userId || null,
            is_active: true,
        });

        await model3d.save();

        res.status(201).json({
            success: true,
            message: 'Modelo 3D creado exitosamente',
            data: model3d,
        });
    } catch (error) {
        if (req.file) {
            await unlink(req.file.path).catch(() => { });
        }
        next(error);
    }
};

export const getModel3Ds = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, isActive, slot } = req.query;

        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);
        const filter = {};

        if (isActive !== undefined) filter.is_active = isActive === 'true';
        if (slot) filter.slot = slot;

        const models = await Model3D.find(filter)
            .select('-uploaded_by')
            .limit(parsedLimit)
            .skip((parsedPage - 1) * parsedLimit)
            .sort({ uploaded_at: -1 });

        const total = await Model3D.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: models,
            pagination: {
                currentPage: parsedPage,
                totalPages: Math.ceil(total / parsedLimit),
                totalRecords: total,
                limit: parsedLimit,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getModel3DById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const model3d = await Model3D.findById(id).select('-uploaded_by');

        if (!model3d) {
            return res.status(404).json({
                success: false,
                message: 'Modelo 3D no encontrado',
            });
        }

        res.status(200).json({ success: true, data: model3d });
    } catch (error) {
        next(error);
    }
};

export const updateModel3D = async (req, res, next) => {
    try {
        const { id } = req.params;
        const model3d = await Model3D.findById(id);

        if (!model3d) {
            return res.status(404).json({
                success: false,
                message: 'Modelo 3D no encontrado',
            });
        }

        const updates = {};
        if (req.body.displayName) updates.display_name = req.body.displayName;
        if (req.body.slot) updates.slot = req.body.slot;
        if (req.body.era !== undefined) updates.era = req.body.era || null;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Debes enviar al menos un campo para actualizar',
            });
        }

        const updated = await Model3D.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true,
        }).select('-uploaded_by');

        res.status(200).json({
            success: true,
            message: 'Modelo 3D actualizado exitosamente',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

export const activateModel3D = async (req, res, next) => {
    try {
        const { id } = req.params;
        const model3d = await Model3D.findByIdAndUpdate(
            id,
            { is_active: true },
            { new: true }
        ).select('-uploaded_by');

        if (!model3d) {
            return res.status(404).json({ success: false, message: 'Modelo 3D no encontrado' });
        }

        res.status(200).json({
            success: true,
            message: 'Modelo 3D activado',
            data: model3d,
        });
    } catch (error) {
        next(error);
    }
};

export const deactivateModel3D = async (req, res, next) => {
    try {
        const { id } = req.params;
        const model3d = await Model3D.findByIdAndUpdate(
            id,
            { is_active: false },
            { new: true }
        ).select('-uploaded_by');

        if (!model3d) {
            return res.status(404).json({ success: false, message: 'Modelo 3D no encontrado' });
        }

        res.status(200).json({
            success: true,
            message: 'Modelo 3D desactivado',
            data: model3d,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteModel3D = async (req, res, next) => {
    try {
        const { id } = req.params;
        const model3d = await Model3D.findById(id);

        if (!model3d) {
            return res.status(404).json({
                success: false,
                message: 'Modelo 3D no encontrado',
            });
        }

        await Model3D.findByIdAndDelete(id);

        const filename = model3d.file_path.split('/').pop();
        const filepath = `${MODELS3D_UPLOAD_DIR}/${filename}`;
        await unlink(filepath).catch(() => { });

        res.status(200).json({
            success: true,
            message: 'Modelo 3D eliminado',
        });
    } catch (error) {
        next(error);
    }
};

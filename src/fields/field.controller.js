import Field from './field.model.js';
import { cloudinary } from '../../middlewares/file-uploader.js';

export const createField = async (req, res, next) => {
    try {
        const fieldData = req.body;

        if (req.coordinatorGrade !== undefined && req.coordinatorGrade !== null) {
            if (fieldData.grade !== req.coordinatorGrade) {
                return res.status(403).json({
                    success: false,
                    message: `Solo puedes crear estudiantes del grado ${req.coordinatorGrade}`,
                });
            }
        }

        if (req.file) {
            fieldData.photo = req.file.path;
            fieldData.photo_public_id = req.file.filename;
        }

        const field = new Field(fieldData);
        await field.save();

        res.status(201).json({
            success: true,
            message: 'Campo creado exitosamente',
            data: field,
        });
    } catch (error) {
        next(error);
    }
}

export const getFields = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, isActive = true } = req.query;

        const parsedPage  = parseInt(page);
        const parsedLimit = parseInt(limit);
        const filter = { isActive };

        const fields = await Field.find(filter)
            .limit(parsedLimit)
            .skip((parsedPage - 1) * parsedLimit)
            .sort({ createdAt: -1 });

        const total = await Field.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: fields,
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
}

// Obtener campo por ID
export const getFieldById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const field = await Field.findById(id);

        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Campo no encontrado',
            });
        }

        res.status(200).json({
            success: true,
            data: field,
        });
    } catch (error) {
        next(error);
    }
};

// Actualizar campo
export const updateField = async (req, res, next) => {
    try {
        const { id } = req.params;

        const currentField = await Field.findById(id);
        if (!currentField) {
            return res.status(404).json({
                success: false,
                message: 'Campo no encontrado',
            });
        }

        if (req.coordinatorGrade !== undefined && req.coordinatorGrade !== null) {
            if (currentField.grade !== req.coordinatorGrade) {
                return res.status(403).json({
                    success: false,
                    message: `Solo puedes actualizar estudiantes del grado ${req.coordinatorGrade}`,
                });
            }
            if (req.body.grade && req.body.grade !== req.coordinatorGrade) {
                return res.status(403).json({
                    success: false,
                    message: `No puedes asignar estudiantes a un grado diferente al tuyo (${req.coordinatorGrade})`,
                });
            }
        }

        const updateData = { ...req.body };

        if (req.file) {
            if (currentField.photo_public_id) {
                await cloudinary.uploader.destroy(currentField.photo_public_id);
            }
            updateData.photo = req.file.path;
            updateData.photo_public_id = req.file.filename;
        }

        const updatedField = await Field.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            success: true,
            message: 'Campo actualizado exitosamente',
            data: updatedField,
        });
    } catch (error) {
        next(error);
    }
};

// Activar campo
export const activateField = async (req, res, next) => {
    try {
        const { id } = req.params;

        const field = await Field.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );

        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Campo no encontrado',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Campo activado exitosamente',
            data: field,
        });
    } catch (error) {
        next(error);
    }
};

// Desactivar campo
export const deactivateField = async (req, res, next) => {
    try {
        const { id } = req.params;

        const field = await Field.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Campo no encontrado',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Campo desactivado exitosamente',
            data: field,
        });
    } catch (error) {
        next(error);
    }
};

// Eliminar campo (hard delete)
export const deleteField = async (req, res, next) => {
    try {
        const { id } = req.params;

        const field = await Field.findById(id);

        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Campo no encontrado',
            });
        }

        if (field.photo_public_id) {
            await cloudinary.uploader.destroy(field.photo_public_id);
        }

        await Field.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Campo eliminado exitosamente',
        });
    } catch (error) {
        next(error);
    }
};


// Obtener campo por carnet
export const getFieldByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const field = await Field.findOne({ idCard });
        if (!field) return res.status(404).json({ success: false, message: 'Campo no encontrado' });
        res.status(200).json({ success: true, data: field });
    } catch (error) { next(error); }
};

// Actualizar campo por carnet
export const updateFieldByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const currentField = await Field.findOne({ idCard });
        if (!currentField) return res.status(404).json({ success: false, message: 'Campo no encontrado' });

        if (req.coordinatorGrade !== undefined && req.coordinatorGrade !== null) {
            if (currentField.grade !== req.coordinatorGrade) {
                return res.status(403).json({
                    success: false,
                    message: `Solo puedes actualizar estudiantes del grado ${req.coordinatorGrade}`,
                });
            }
            if (req.body.grade && req.body.grade !== req.coordinatorGrade) {
                return res.status(403).json({
                    success: false,
                    message: `No puedes asignar estudiantes a un grado diferente al tuyo (${req.coordinatorGrade})`,
                });
            }
        }

        const updateData = { ...req.body };
        if (req.file) {
            if (currentField.photo_public_id) await cloudinary.uploader.destroy(currentField.photo_public_id);
            updateData.photo = req.file.path;
            updateData.photo_public_id = req.file.filename;
        }

        const updatedField = await Field.findOneAndUpdate({ idCard }, updateData, { new: true, runValidators: true });
        res.status(200).json({ success: true, message: 'Campo actualizado exitosamente', data: updatedField });
    } catch (error) { next(error); }
};

// Activar campo por carnet
export const activateFieldByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const field = await Field.findOneAndUpdate({ idCard }, { isActive: true }, { new: true });
        if (!field) return res.status(404).json({ success: false, message: 'Campo no encontrado' });
        res.status(200).json({ success: true, message: 'Campo activado exitosamente', data: field });
    } catch (error) { next(error); }
};

// Desactivar campo por carnet
export const deactivateFieldByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const field = await Field.findOneAndUpdate({ idCard }, { isActive: false }, { new: true });
        if (!field) return res.status(404).json({ success: false, message: 'Campo no encontrado' });
        res.status(200).json({ success: true, message: 'Campo desactivado exitosamente', data: field });
    } catch (error) { next(error); }
};

// Eliminar campo por carnet
export const deleteFieldByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const field = await Field.findOne({ idCard });
        if (!field) return res.status(404).json({ success: false, message: 'Campo no encontrado' });
        if (field.photo_public_id) await cloudinary.uploader.destroy(field.photo_public_id);
        await Field.findOneAndDelete({ idCard });
        res.status(200).json({ success: true, message: 'Campo eliminado exitosamente' });
    } catch (error) { next(error); }
};
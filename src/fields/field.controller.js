import { parse } from 'dotenv';
import Field from './field.model.js';

export const createField = async (req, res) => {
    try {

        const fieldData = req.body;

        if (req.file) {
            fieldData.photo = req.file.path;
        }

        const field = new Field(fieldData);
        await field.save();

        res.status(201).json({
            success: true,
            message: 'Campo creado exitosamente',
            data: field
        })

    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al crear campo',
            error: error.message
        })
    }
}

export const getFields = async (req, res) => {

    try {
        const { page = 1, limit = 10, isActive = true } = req.query;

        const filter = { isActive };

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 }
        }

        const fields = await Field.find(filter)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort(options.sort);

        const total = await Field.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: fields,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit
            }
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener los campos',
            error: error.message
        })
    }

}

// Obtener campo por ID
export const getFieldById = async (req, res) => {
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
        res.status(500).json({
            success: false,
            message: 'Error al obtener el campo',
            error: error.message,
        });
    }
};

// Actualizar campo
export const updateField = async (req, res) => {
    try {
        const { id } = req.params;

        const currentField = await Field.findById(id);
        if (!currentField) {
            return res.status(404).json({
                success: false,
                message: "Campo no encontrado",
            });
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
            message: "Campo actualizado exitosamente",
            data: updatedField,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al actualizar campo",
            error: error.message,
        });
    }
};

// Cambiar estado del campo (activar/desactivar)
export const changeFieldStatus = async (req, res) => {
    try {
        const { id } = req.params;
        // Detectar si es activate o deactivate desde la URL
        const isActive = req.url.includes('/activate');
        const action = isActive ? 'activado' : 'desactivado';

        const field = await Field.findByIdAndUpdate(
            id,
            { isActive },
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
            message: `Campo ${action} exitosamente`,
            data: field,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al cambiar el estado del campo',
            error: error.message,
        });
    }
};
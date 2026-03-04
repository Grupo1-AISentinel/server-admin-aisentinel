import Coordinator from './coordinator.model.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

/**
 * Llama al authservice para crear un usuario internamente (ya activado, sin verificar email).
 */
const createAuthUser = async (userData) => {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/internal/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-token': INTERNAL_API_TOKEN,
        },
        body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.message || 'Error al crear usuario en el servicio de autenticación');
        error.statusCode = response.status;
        throw error;
    }

    return data;
};

/**
 * Llama al authservice para eliminar un usuario internamente.
 */
const deleteAuthUser = async (authUserId) => {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/internal/users/${authUserId}`, {
        method: 'DELETE',
        headers: {
            'x-internal-token': INTERNAL_API_TOKEN,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.message || 'Error al eliminar usuario en el servicio de autenticación');
        error.statusCode = response.status;
        throw error;
    }

    return data;
};

// ─── COORDINADORES ───────────────────────────────────────────────────────────

/**
 * POST /coordinators
 * Crea un usuario con rol Coordinador en el authservice
 * y su perfil de coordinador en este servicio.
 */
export const createCoordinator = async (req, res, next) => {
    let authUserId = null;
    try {
        const { name, surname, username, email, password, phone, grade } = req.body;

        // 1. Crear usuario en authservice con rol Coordinador
        const authResult = await createAuthUser({
            name,
            surname,
            username,
            email,
            password,
            phone,
            role: 'Coordinador',
        });

        authUserId = authResult.data.id;

        // 2. Crear perfil de coordinador en MongoDB
        const coordinator = new Coordinator({
            authUserId,
            firstName: name,
            lastName: surname,
            grade,
            phone: phone || null,
        });

        await coordinator.save();

        return res.status(201).json({
            success: true,
            message: 'Coordinador creado exitosamente',
            data: {
                coordinator,
                authUser: authResult.data,
            },
        });
    } catch (error) {
        // Si el coordinador ya fue creado en auth pero falló en mongo, revertir
        if (authUserId) {
            try {
                await deleteAuthUser(authUserId);
            } catch (rollbackError) {
                console.error('Error al revertir usuario en authservice:', rollbackError.message);
            }
        }
        next(error);
    }
};

/**
 * POST /coordinators/admin
 * Crea únicamente un usuario con rol Administrador en el authservice
 * (no crea perfil en este servicio).
 */
export const createAdmin = async (req, res, next) => {
    try {
        const { name, surname, username, email, password, phone } = req.body;

        const authResult = await createAuthUser({
            name,
            surname,
            username,
            email,
            password,
            phone,
            role: 'Administrador',
        });

        return res.status(201).json({
            success: true,
            message: 'Administrador creado exitosamente',
            data: authResult.data,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /coordinators
 * Lista todos los coordinadores con paginación.
 */
export const getCoordinators = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, isActive, grade } = req.query;

        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);

        const filter = {};
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (grade) filter.grade = grade;

        const coordinators = await Coordinator.find(filter)
            .limit(parsedLimit)
            .skip((parsedPage - 1) * parsedLimit)
            .sort({ createdAt: -1 });

        const total = await Coordinator.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: coordinators,
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

/**
 * GET /coordinators/:id
 * Obtiene un coordinador por su ID de MongoDB.
 */
export const getCoordinatorById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const coordinator = await Coordinator.findById(id);

        if (!coordinator) {
            return res.status(404).json({
                success: false,
                message: 'Coordinador no encontrado',
            });
        }

        return res.status(200).json({
            success: true,
            data: coordinator,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /coordinators/:id
 * Actualiza los datos del perfil de coordinador (grado, teléfono, isActive).
 * No modifica el usuario en authservice.
 */
export const updateCoordinator = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { grade, phone, isActive } = req.body;

        const coordinator = await Coordinator.findById(id);
        if (!coordinator) {
            return res.status(404).json({
                success: false,
                message: 'Coordinador no encontrado',
            });
        }

        if (grade !== undefined) coordinator.grade = grade;
        if (phone !== undefined) coordinator.phone = phone;
        if (isActive !== undefined) coordinator.isActive = isActive;

        await coordinator.save();

        return res.status(200).json({
            success: true,
            message: 'Coordinador actualizado exitosamente',
            data: coordinator,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /coordinators/:id
 * Elimina el coordinador de MongoDB Y el usuario del authservice.
 * Relación 1:1: si no existe uno, no existe el otro.
 */
export const deleteCoordinator = async (req, res, next) => {
    try {
        const { id } = req.params;

        const coordinator = await Coordinator.findById(id);
        if (!coordinator) {
            return res.status(404).json({
                success: false,
                message: 'Coordinador no encontrado',
            });
        }

        // Eliminar en authservice primero
        await deleteAuthUser(coordinator.authUserId);

        // Eliminar en MongoDB
        await coordinator.deleteOne();

        return res.status(200).json({
            success: true,
            message: 'Coordinador eliminado exitosamente',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /coordinators/:id/activate
 */
export const activateCoordinator = async (req, res, next) => {
    try {
        const { id } = req.params;
        const coordinator = await Coordinator.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );

        if (!coordinator) {
            return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
        }

        return res.status(200).json({ success: true, message: 'Coordinador activado', data: coordinator });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /coordinators/:id/deactivate
 */
export const deactivateCoordinator = async (req, res, next) => {
    try {
        const { id } = req.params;
        const coordinator = await Coordinator.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!coordinator) {
            return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
        }

        return res.status(200).json({ success: true, message: 'Coordinador desactivado', data: coordinator });
    } catch (error) {
        next(error);
    }
};

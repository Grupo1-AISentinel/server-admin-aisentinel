import { ADMIN_ROLE, COORDINATOR_ROLE } from '../../middlewares/validate-role.js';
import Coordinator from './coordinator.model.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;


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


export const createCoordinator = async (req, res, next) => {
    let authUserId = null;
    let weCreatedAuthUser = false;
    try {
        const { name, surname, username, email, password, phone, grade } = req.body;

        // 1. Intentar crear usuario en authservice con rol COORDINATOR_ROLE.
        // Si el email/username ya existe, auth devuelve 409 y debemos ABORTAR
        // (no rollback, porque no creamos nada nuestro que revertir).
        const authResult = await createAuthUser({
            name,
            surname,
            username,
            email,
            password,
            phone,
            role: COORDINATOR_ROLE,
        });

        weCreatedAuthUser = true;
        authUserId = authResult.data.id;

        const coordinator = new Coordinator({
            authUserId,
            firstName: name,
            lastName: surname,
            email,
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
        // Solo hacer rollback del usuario auth si lo creamos nosotros en
        // este request. Si ya existia (error 409), no nos pertenece.
        if (weCreatedAuthUser && authUserId) {
            try {
                await deleteAuthUser(authUserId);
            } catch (rollbackError) {
                console.error('Error al revertir usuario en authservice:', rollbackError.message);
            }
        }
        // Si el error es 409 (email duplicado), responder BadRequest claro
        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un usuario con ese email o nombre de usuario',
            });
        }
        next(error);
    }
};


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
            role: ADMIN_ROLE,
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

// Devuelve el perfil de coordinador del usuario autenticado.
// ADMIN_ROLE: retorna { isAdmin: true, coordinator: null } para que el cliente
// sepa que no hay restricción de grado. COORDINATOR_ROLE: busca el doc Coordinator
// por authUserId; si no existe (p.ej. usuario recién creado), 404 con mensaje
// claro para que el cliente limpie coordinatorGrade.
export const getMyCoordinatorProfile = async (req, res, next) => {
    try {
        if (req.userRole === ADMIN_ROLE) {
            return res.status(200).json({
                success: true,
                data: { isAdmin: true, coordinator: null },
            });
        }

        const coordinator = await Coordinator.findOne({ authUserId: req.userId });

        if (!coordinator) {
            return res.status(404).json({
                success: false,
                message: 'Este usuario no tiene perfil de coordinador',
            });
        }

        return res.status(200).json({
            success: true,
            data: { isAdmin: false, coordinator },
        });
    } catch (error) {
        next(error);
    }
};


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

        await deleteAuthUser(coordinator.authUserId);

        await coordinator.deleteOne();

        return res.status(200).json({
            success: true,
            message: 'Coordinador eliminado exitosamente',
        });
    } catch (error) {
        next(error);
    }
};


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

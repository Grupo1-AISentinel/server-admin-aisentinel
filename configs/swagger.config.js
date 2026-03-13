import swaggerUi from 'swagger-ui-express';

const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'AISentinel Admin API',
        version: '1.0.0',
        description: 'Documentación completa de la API del panel administrativo de AISentinel.',
    },
    servers: [
        {
            url: 'http://localhost:3067/AISentinelAdmin/v1',
            description: 'Servidor Local de Desarrollo'
        }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        },
        schemas: {
            Student: {
                type: 'object',
                properties: {
                    studentName: { type: 'string', example: 'Juan' },
                    studentSurname: { type: 'string', example: 'Pérez' },
                    idCard: { type: 'string', example: '2026001' },
                    grade: { type: 'string', enum: ['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'] }
                }
            },
            Coordinator: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'Carlos' },
                    surname: { type: 'string', example: 'López' },
                    username: { type: 'string', example: 'clopez123' },
                    email: { type: 'string', example: 'clopez@kinal.edu.gt' },
                    password: { type: 'string', example: 'Password123!' },
                    phone: { type: 'string', example: '12345678' },
                    grade: { type: 'string', enum: ['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'] }
                }
            },
            Uniform: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'Chumpa Oficial 2026' },
                    type: { type: 'string', enum: ['JACKET', 'TSHIRT', 'PANTS'] }
                }
            }
        }
    },
    security: [{ bearerAuth: [] }],
    paths: {
        // ==========================================
        // MÓDULO DE ESTUDIANTES
        // ==========================================
        '/students/create': {
            post: {
                tags: ['Estudiantes'],
                summary: 'Crear un nuevo estudiante',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    studentName: { type: 'string' },
                                    studentSurname: { type: 'string' },
                                    idCard: { type: 'string' },
                                    grade: { type: 'string', enum: ['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'] },
                                    photo: { type: 'array', items: { type: 'string', format: 'binary' } }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Estudiante creado' } }
            }
        },
        '/students/get': {
            get: {
                tags: ['Estudiantes'],
                summary: 'Obtener lista de estudiantes',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                    { name: 'isActive', in: 'query', schema: { type: 'boolean', default: true } }
                ],
                responses: { 200: { description: 'Lista de estudiantes' } }
            }
        },
        '/students/{id}': {
            get: {
                tags: ['Estudiantes'],
                summary: 'Obtener estudiante por ID',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Estudiante encontrado' } }
            },
            put: {
                tags: ['Estudiantes'],
                summary: 'Actualizar estudiante (requiere 3 imágenes nuevas)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/Student' } } }
                },
                responses: { 200: { description: 'Estudiante actualizado' } }
            },
            delete: {
                tags: ['Estudiantes'],
                summary: 'Eliminar estudiante (Hard Delete)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Estudiante eliminado' } }
            }
        },
        '/students/{id}/activate': {
            put: {
                tags: ['Estudiantes'],
                summary: 'Activar estudiante por ID',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Estudiante activado' } }
            }
        },
        '/students/{id}/deactivate': {
            put: {
                tags: ['Estudiantes'],
                summary: 'Desactivar estudiante por ID',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Estudiante desactivado' } }
            }
        },

        // ==========================================
        // MÓDULO DE COORDINADORES / ADMIN
        // ==========================================
        '/coordinators/create': {
            post: {
                tags: ['Coordinadores'],
                summary: 'Crear un coordinador',
                requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Coordinator' } } } },
                responses: { 201: { description: 'Coordinador creado' } }
            }
        },
        '/coordinators/admin/create': {
            post: {
                tags: ['Coordinadores'],
                summary: 'Crear un administrador',
                requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Coordinator' } } } },
                responses: { 201: { description: 'Administrador creado' } }
            }
        },
        '/coordinators/get': {
            get: {
                tags: ['Coordinadores'],
                summary: 'Listar coordinadores',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer' } },
                    { name: 'grade', in: 'query', schema: { type: 'string' } },
                    { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
                ],
                responses: { 200: { description: 'Lista obtenida' } }
            }
        },
        '/coordinators/{id}': {
            get: {
                tags: ['Coordinadores'],
                summary: 'Obtener coordinador por ID',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Detalle del coordinador' } }
            },
            put: {
                tags: ['Coordinadores'],
                summary: 'Actualizar coordinador',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { grade: { type: 'string' }, phone: { type: 'string' }, isActive: { type: 'boolean' } } } } } },
                responses: { 200: { description: 'Coordinador actualizado' } }
            },
            delete: {
                tags: ['Coordinadores'],
                summary: 'Eliminar coordinador',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Coordinador eliminado' } }
            }
        },
        '/coordinators/{id}/activate': {
            put: {
                tags: ['Coordinadores'],
                summary: 'Activar coordinador',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Activado' } }
            }
        },
        '/coordinators/{id}/deactivate': {
            put: {
                tags: ['Coordinadores'],
                summary: 'Desactivar coordinador',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Desactivado' } }
            }
        },

        // ==========================================
        // MÓDULO DE INSPECCIONES
        // ==========================================
        '/inspections/toggle/{grade}': {
            put: {
                tags: ['Inspecciones'],
                summary: 'Activar o desactivar inspección de un grado',
                parameters: [{ name: 'grade', in: 'path', required: true, schema: { type: 'string', enum: ['1RO', '2DO', '3RO', '4TO', '5TO', '6TO'] } }],
                responses: { 200: { description: 'Estado de inspección cambiado' } }
            }
        },

        // ==========================================
        // MÓDULO DE UNIFORMES
        // ==========================================
        '/uniforms/create': {
            post: {
                tags: ['Uniformes'],
                summary: 'Crear un nuevo uniforme',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    type: { type: 'string', enum: ['JACKET', 'TSHIRT', 'PANTS'] },
                                    photos: { type: 'array', items: { type: 'string', format: 'binary' } }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Uniforme creado' } }
            }
        },
        '/uniforms/get': {
            get: {
                tags: ['Uniformes'],
                summary: 'Obtener lista de uniformes',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer' } },
                    { name: 'type', in: 'query', schema: { type: 'string' } },
                    { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
                ],
                responses: { 200: { description: 'Lista de uniformes' } }
            }
        },
        '/uniforms/{name}': {
            get: {
                tags: ['Uniformes'],
                summary: 'Obtener uniforme por nombre exacto',
                parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Uniforme encontrado' } }
            },
            put: {
                tags: ['Uniformes'],
                summary: 'Actualizar uniforme',
                parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    type: { type: 'string', enum: ['JACKET', 'TSHIRT', 'PANTS'] },
                                    photos: { type: 'array', items: { type: 'string', format: 'binary' } }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Uniforme actualizado' } }
            }
        },
        '/uniforms/{name}/thumbnail': {
            get: {
                tags: ['Uniformes'],
                summary: 'Obtener imagen thumbnail del uniforme',
                parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Imagen binaria' } },
                security: [] // Este endpoint usualmente no requiere JWT si se carga en etiquetas <img>
            }
        },
        '/uniforms/{name}/activate': {
            put: {
                tags: ['Uniformes'],
                summary: 'Activar uniforme',
                parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Uniforme activado' } }
            }
        },
        '/uniforms/{name}/deactivate': {
            put: {
                tags: ['Uniformes'],
                summary: 'Desactivar uniforme',
                parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Uniforme desactivado' } }
            }
        },

        // ==========================================
        // MÓDULO DE ESTADÍSTICAS
        // ==========================================
        '/statistics/grades': {
            get: { tags: ['Estadísticas'], summary: 'Obtener infracciones por grado', responses: { 200: { description: 'Datos obtenidos' } } }
        },
        '/statistics/grades/export': {
            post: {
                tags: ['Estadísticas'], summary: 'Exportar PDF de grados',
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } } },
                responses: { 200: { description: 'PDF enviado' } }
            }
        },
        '/statistics/students': {
            get: { tags: ['Estadísticas'], summary: 'Obtener top 10 estudiantes con infracciones', responses: { 200: { description: 'Datos obtenidos' } } }
        },
        '/statistics/students/export': {
            post: {
                tags: ['Estadísticas'], summary: 'Exportar PDF de estudiantes',
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } } },
                responses: { 200: { description: 'PDF enviado' } }
            }
        },
        '/statistics/objects': {
            get: { tags: ['Estadísticas'], summary: 'Obtener infracciones por objeto', responses: { 200: { description: 'Datos obtenidos' } } }
        },
        '/statistics/objects/export': {
            post: {
                tags: ['Estadísticas'], summary: 'Exportar PDF de objetos',
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } } },
                responses: { 200: { description: 'PDF enviado' } }
            }
        },
        '/statistics/days': {
            get: { tags: ['Estadísticas'], summary: 'Obtener infracciones por día', responses: { 200: { description: 'Datos obtenidos' } } }
        },
        '/statistics/days/export': {
            post: {
                tags: ['Estadísticas'], summary: 'Exportar PDF de días',
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } } },
                responses: { 200: { description: 'PDF enviado' } }
            }
        },

        // ==========================================
        // MÓDULO DE AUDITORÍA (Opcional - si aplicaste el código anterior)
        // ==========================================
        '/audit/get': {
            get: {
                tags: ['Auditoría'],
                summary: 'Ver historial de movimientos',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer' } }
                ],
                responses: { 200: { description: 'Historial obtenido' } }
            }
        }
    }
};

export const swaggerSetup = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
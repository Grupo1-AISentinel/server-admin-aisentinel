'use strict';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { dbConnection } from './db.js';
import { corsOptions } from './cors-configuration.js';
import { helmetConfiguration } from './helmet-configuration.js';
import { swaggerSetup } from './swagger.config.js';
import { requestLimit } from '../middlewares/request-limit.js';
import { errorHandler } from '../middlewares/handle-errors.js';
import { auditLogger } from '../middlewares/audit-logger.js';
import auditRouter from '../src/audit/audit.routes.js';
import studentRouter from '../src/students/student.routes.js';
import inspectionRouter from '../src/inspection/inspection.routes.js'
import coordinatorRouter from '../src/coordinator/coordinator.routes.js';
import statisticsRouter from '../src/statistics/statistics.routes.js';
import uniformRouter from '../src/uniform/uniform.routes.js';
import { createServer } from 'http'; // Permite crear el servidor compatible con WebSockets
import { Server } from 'socket.io';

const BASE_PATH = '/AISentinelAdmin/v1';

export let io;

const middlewares = (app) => {
    app.use(express.urlencoded({ extended: false, limit: '50mb' }));
    app.use(express.json({ limit: '50mb' }));
    app.use(cors(corsOptions));
    app.use(helmet(helmetConfiguration));
    app.use(requestLimit);
    app.use(morgan('dev'));
}

const routes = (app) => {

    swaggerSetup(app);
    
    app.get(`${BASE_PATH}/Health`, (request, response) => {
        response.status(200).json({
            status: 'Healthy',
            timestamp: new Date().toISOString(),
            service: 'AISentinel Admin Server'
        })
    })

    app.use(auditLogger);

    app.use(`${BASE_PATH}/students`, studentRouter);
    app.use(`${BASE_PATH}/coordinators`, coordinatorRouter);
    app.use(`${BASE_PATH}/inspections`, inspectionRouter);
    app.use(`${BASE_PATH}/statistics`, statisticsRouter);
    app.use(`${BASE_PATH}/uniforms`, uniformRouter);
    app.use(`${BASE_PATH}/audits`, auditRouter);

    app.use((req, res) => {
        res.status(404).json({
            success: false,
            message: 'Endpoint no encontrado en Admin Api'
        })
    })
}

export const initServer = async () => {
    const app = express();
    const PORT = process.env.PORT;
    const httpServer = createServer(app);
    io = new Server(httpServer, {
        cors: corsOptions,
        maxHttpBufferSize: 1e8 // 100 megabytes
    });
    app.set('trust proxy', 1);
    app.set('socketio', io);

    try {
        await dbConnection();
        middlewares(app);
        routes(app);
        app.use(errorHandler);

        io.on('connection', (socket) => {
            console.log('Cliente conectado (Python o Front):', socket.id);
            
            // Recibir confirmación de procesamiento de Python
            socket.on('python_registro_completado', (data) => {
                console.log(`IA completó procesamiento: Carnet ${data.carnet}`);
            });

            socket.on('disconnect', () => {
                console.log('Cliente desconectado:', socket.id);
            });
        });

        httpServer.listen(PORT, () => {
            console.log(`AISentinel Admin server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}${BASE_PATH}/health`);
        })
    } catch (error) {
        console.error(`Error starting Admin Server: ${error.message}`);
        process.exit(1);
    }
}
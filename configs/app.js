'use strict';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { join, resolve } from 'path';
import { dbConnection } from './db.js';
import { corsOptions } from './cors-configuration.js';
import { helmetConfiguration } from './helmet-configuration.js';
import { swaggerSetup } from './swagger.config.js';
import { requestLimit, autoDetectionLimit } from '../middlewares/request-limit.js';
import { errorHandler } from '../middlewares/handle-errors.js';
import { auditLogger } from '../middlewares/audit-logger.js';
import auditRouter from '../src/audit/audit.routes.js';
import studentRouter from '../src/students/student.routes.js';
import inspectionRouter from '../src/inspection/inspection.routes.js'
import coordinatorRouter from '../src/coordinator/coordinator.routes.js';
import statisticsRouter from '../src/statistics/statistics.routes.js';
import uniformRouter from '../src/uniform/uniform.routes.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import alertRouter from '../src/alerts/alerts.routes.js';
import { processAutomaticDetection } from '../src/alerts/alerts.controller.js';
import attendanceRouter from '../src/attendances/attendance.routes.js';
import cameraRouter from '../src/cameras/camera.routes.js';
import notificationRouter from '../src/notifications/notification.routes.js';
import preferenceRouter from '../src/preferences/preference.routes.js';
import adminRouter from '../src/admin/admin.routes.js';
import model3DRouter from '../src/models3d/models3d.routes.js';
import { MODELS3D_UPLOAD_DIR } from '../middlewares/models3d-uploader.js';
import { setupDetectionRelay } from './socket-relay.js';
import { startPyimageHealthMonitor } from './pyimage-health.js';
import { startDailyReportScheduler } from '../utils/daily-report-job.js';

const BASE_PATH = '/AISentinelAdmin/v1';

export let io;

const middlewares = (app) => {
    app.use(express.urlencoded({ extended: false, limit: '50mb' }));
    app.use(express.json({ limit: '50mb' }));
    app.use(cors(corsOptions));
    app.use(
        '/videos',
        express.static(
            process.env.VIDEO_UPLOAD_DIR ||
                resolve(process.cwd(), 'uploads', 'camera-videos'),
            {
                fallthrough: true,
                maxAge: '1h',
                setHeaders: (res) => {
                    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
                },
            }
        )
    );
    app.use(
        `${BASE_PATH}/models3d/files`,
        express.static(MODELS3D_UPLOAD_DIR, {
            fallthrough: true,
            maxAge: '7d',
            setHeaders: (res) => {
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                res.setHeader('Content-Type', 'model/gltf-binary');
            },
        })
    );
    app.use(helmet(helmetConfiguration));
    app.use(morgan('dev'));
}

const routes = (app) => {

    app.use(requestLimit);

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
    app.post(`${BASE_PATH}/alerts/automatic-detection`, autoDetectionLimit, processAutomaticDetection);
    app.use(`${BASE_PATH}/alerts`, alertRouter);
    app.use(`${BASE_PATH}/cameras`, cameraRouter);
    app.use(`${BASE_PATH}/audits`, auditRouter);
    app.use(`${BASE_PATH}/attendance`, autoDetectionLimit, attendanceRouter);
    app.use(`${BASE_PATH}/notifications`, notificationRouter);
    app.use(`${BASE_PATH}/preferences`, preferenceRouter);
    app.use(`${BASE_PATH}/admin`, adminRouter);
    app.use(`${BASE_PATH}/models3d`, model3DRouter);

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

            setupDetectionRelay(io);
            const pyimageMonitor = startPyimageHealthMonitor(io);
            app.set('pyimageMonitor', pyimageMonitor);
            pyimageMonitor.start();
            startDailyReportScheduler();

            // Auto-seed demo: si la coleccion Coordinator esta vacia y existe
            // el modulo seeder, crear el coordinador principal en background.
            // Idempotente: solo corre si Mongo no tiene ningun Coordinator.
            if (process.env.SKIP_AUTOSEED !== '1') {
                setTimeout(() => {
                    import('../helpers/seed-demo.js').then(async (mod) => {
                        try {
                            await mod.runSeedDemo();
                        } catch (e) {
                            console.warn(`[auto-seed-demo] ${e.message}`);
                        }
                    }).catch((e) => console.warn(`[auto-seed-demo] import: ${e.message}`));
                }, 2000);
            }

            // Auto-seed assets: si las colecciones Student/Uniform de Mongo
            // estan vacias, lee assets/students y assets/uniforms y los envia
            // a los endpoints /create-bulk del propio admin (que a su vez
            // generan embeddings en pyimage). Idempotente.
            if (process.env.SKIP_AUTOSEED !== '1') {
                setTimeout(() => {
                    import('../helpers/seed-assets.js').then(async (mod) => {
                        try {
                            await mod.default();
                        } catch (e) {
                            console.warn(`[auto-seed-assets] ${e.message}`);
                        }
                    }).catch((e) => console.warn(`[auto-seed-assets] import: ${e.message}`));
                }, 5000);
            }

            httpServer.listen(PORT, () => {
            console.log(`AISentinel Admin server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}${BASE_PATH}/health`);
        })
    } catch (error) {
        console.error(`Error starting Admin Server: ${error.message}`);
        process.exit(1);
    }
}
/**
 * cleanup-old-seed.js
 * Borra los coordinadores coord.*@kinal.edu.gt y las camaras CAM-DEMO-*
 * que dejo el seeder anterior. Idempotente.
 *
 * Uso: node helpers/cleanup-old-seed.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Coordinator from '../src/coordinator/coordinator.model.js';
import Camera from '../src/cameras/camera.model.js';
import { dbConnection } from '../configs/db.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3069';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

const deleteAuthUser = async (authUserId) => {
    try {
        await fetch(`${AUTH_SERVICE_URL}/api/v1/internal/users/${authUserId}`, {
            method: 'DELETE',
            headers: { 'x-internal-token': INTERNAL_API_TOKEN },
        });
    } catch (e) {
        console.warn(`    [WARN] no se pudo borrar auth user ${authUserId}: ${e.message}`);
    }
};

const main = async () => {
    console.log('Limpiando coordinadores coord.* y camaras CAM-DEMO-*...');
    await dbConnection();

    const oldCoords = await Coordinator.find({
        email: { $regex: /^coord\./ },
    });
    console.log(`  ${oldCoords.length} coordinadores antiguos encontrados.`);
    for (const c of oldCoords) {
        await Coordinator.deleteOne({ _id: c._id });
        console.log(`  [OK] Borrado Coordinator ${c.email}`);
        await deleteAuthUser(c.authUserId);
        console.log(`    -> Auth user ${c.authUserId} borrado`);
    }

    const oldCams = await Camera.find({
        cameraId: { $regex: /^CAM-DEMO-/ },
    });
    console.log(`  ${oldCams.length} camaras demo encontradas.`);
    for (const cam of oldCams) {
        await Camera.deleteOne({ _id: cam._id });
        console.log(`  [OK] Borrada camara ${cam.cameraId}`);
    }

    await mongoose.disconnect();
    console.log('COMPLETADO.');
};

main().catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
});

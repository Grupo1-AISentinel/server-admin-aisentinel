/**
 * seed-demo.js — Seeder del coordinador principal de demo.
 *
 * Crea:
 *  - 1 coordinador principal (Angel Siliezar / asiliezar) usado para
 *    las pruebas en vivo. Email real del colegio, sin camaras.
 *
 * Las camaras se crean MANUALMENTE desde la UI (mas control del demo).
 *
 * Requisitos:
 *  - auth-service corriendo en AUTH_SERVICE_URL (default http://localhost:3069)
 *  - INTERNAL_API_TOKEN en .env
 *
 * Uso:
 *   node helpers/seed-demo.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Coordinator from '../src/coordinator/coordinator.model.js';
import { dbConnection } from '../configs/db.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3069';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

const COORDINATORS = [
    {
        name: 'Angel',
        surname: 'Siliezar',
        username: 'asiliezar',
        email: 'asiliezar-2024342@kinal.edu.gt',
        password: 'coins123',
        grade: '6TO',
    },
];

const createAuthUser = async (userData) => {
    const resp = await fetch(`${AUTH_SERVICE_URL}/api/v1/internal/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-token': INTERNAL_API_TOKEN,
        },
        body: JSON.stringify({ ...userData, role: 'COORDINATOR_ROLE' }),
    });
    const data = await resp.json();
    if (!resp.ok) {
        if (resp.status === 409 || data.message?.toLowerCase().includes('ya existe')) {
            return { exists: true };
        }
        throw new Error(`auth-service ${resp.status}: ${data.message}`);
    }
    return { exists: false, data };
};

const findAuthUserIdByEmail = async (email) => {
    try {
        const resp = await fetch(`${AUTH_SERVICE_URL}/api/v1/internal/users/by-email?email=${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: { 'x-internal-token': INTERNAL_API_TOKEN },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data?.data?.id || data?.data?.Id || data?.id || null;
    } catch {
        return null;
    }
};

const seedCoordinators = async () => {
    let created = 0;
    let skipped = 0;
    for (const c of COORDINATORS) {
        const existing = await Coordinator.findOne({ email: c.email });
        if (existing) {
            console.log(`  [SKIP] Coordinador ${c.email} ya existe (authUserId=${existing.authUserId})`);
            skipped += 1;
            continue;
        }
        try {
            const authResult = await createAuthUser(c);
            let authUserId = null;
            if (authResult.exists) {
                console.log(`  [INFO] Usuario auth ${c.email} ya existe. Buscando su authUserId...`);
                authUserId = await findAuthUserIdByEmail(c.email);
                if (!authUserId) {
                    console.warn(`  [WARN] No pude obtener authUserId de ${c.email}, omitido.`);
                    skipped += 1;
                    continue;
                }
            } else {
                authUserId = authResult.data?.data?.id || authResult.data?.id || authResult.data?.Id || authResult.data?.userId;
            }
            if (!authUserId) {
                console.warn(`  [WARN] authUserId no encontrado para ${c.email}, omitido.`);
                skipped += 1;
                continue;
            }
            await Coordinator.create({
                authUserId: String(authUserId),
                firstName: c.name,
                lastName: c.surname,
                email: c.email,
                grade: c.grade,
                phone: null,
            });
            console.log(`  [OK] Coordinador ${c.name} ${c.surname} (${c.grade}) — email=${c.email} — authUserId=${authUserId}`);
            created += 1;
        } catch (e) {
            console.error(`  [ERR] ${c.email}: ${e.message}`);
        }
    }
    console.log(`Coordinadores: ${created} creados, ${skipped} omitidos.`);
};

const main = async () => {
    console.log('='.repeat(65));
    console.log('  SEED DEMO — Coordinador principal');
    console.log('='.repeat(65));
    if (!INTERNAL_API_TOKEN) {
        console.error('ERROR: INTERNAL_API_TOKEN no esta definido en .env');
        process.exit(1);
    }
    await dbConnection();
    await seedCoordinators();
    console.log('');
    console.log('='.repeat(65));
    console.log('  COMPLETADO');
    console.log('='.repeat(65));
    console.log('  Login: asiliezr-2024342@kinal.edu.gt / coord123');
    console.log('  (Username alternativo: asiliezar)');
    console.log('  Las camaras se crean desde la UI manualmente.');
    console.log('='.repeat(65));
    await mongoose.disconnect();
    process.exit(0);
};

export const runSeedDemo = async () => {
    if (!INTERNAL_API_TOKEN) {
        console.warn('[auto-seed-demo] INTERNAL_API_TOKEN no definido, omitido.');
        return;
    }
    if (mongoose.connection.readyState !== 1) {
        console.warn('[auto-seed-demo] Mongo no conectado, omitido.');
        return;
    }
    try {
        // Solo auto-seedear si la coleccion Coordinator esta COMPLETAMENTE vacia.
        // Si hay хотя бы uno, asumimos demo ya cargada o usuario a cargo.
        const count = await Coordinator.countDocuments();
        if (count > 0) {
            console.log(`[auto-seed-demo] Coordinadores existentes: ${count}. Omitido.`);
            return;
        }
        console.log('[auto-seed-demo] Mongo vacio, poblando coordinador principal...');
        await seedCoordinators();
        console.log('[auto-seed-demo] OK');
    } catch (e) {
        console.warn(`[auto-seed-demo] fallo: ${e.message}`);
    }
};

// Auto-ejecucion solo cuando se llama directamente como script:
//   node helpers/seed-demo.js
// Cuando es importado (ej. desde app.js para auto-seed), se ignora este bloque.
import { fileURLToPath } from 'url';
import { argv } from 'process';

const __filename = fileURLToPath(import.meta.url);
const isInvokedDirectly = argv[1] && (
    argv[1].endsWith('seed-demo.js') ||
    argv[1] === __filename
);

if (isInvokedDirectly) {
    main().catch((e) => {
        console.error('FATAL:', e);
        process.exit(1);
    });
}

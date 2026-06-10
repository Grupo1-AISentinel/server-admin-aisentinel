/**
 * seed-assets.js — Seeder automatico de estudiantes y uniformes.
 *
 * Lee imagenes de server-admin-aisentinel/assets/{students,uniforms}/
 * y las envia a los endpoints /students/create-bulk y /uniforms/create-bulk
 * del propio admin (que a su vez hablan con pyimage para embeddings).
 *
 * IDEMPOTENTE: corre solo si Mongo de students esta vacio y Mongo de
 * uniforms esta vacio. Si hay хотя бы uno, omite el seeder entero.
 *
 * Autoejecucion: importado desde configs/app.js con setTimeout 5s
 * (asi da tiempo a que pyimage termine su auto-sync Mongo del lifespan).
 *
 * Ejecucion manual:
 *   node helpers/seed-assets.js
 *   node helpers/seed-assets.js --force   # re-seed aunque haya datos
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Student from '../src/students/student.model.js';
import Uniform from '../src/uniform/uniform.model.js';
import { dbConnection } from '../configs/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..');

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || `http://localhost:${process.env.PORT || 3067}`;
const ADMIN_PATH     = '/AISentinelAdmin/v1';
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

const STUDENTS_DIR = path.join(REPO_ROOT, 'assets', 'students');
const UNIFORMS_DIR = path.join(REPO_ROOT, 'assets', 'uniforms');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);


const listImages = (dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
        .map((f) => path.join(dir, f))
        .sort();
};


const listStudentDirs = () => {
    if (!fs.existsSync(STUDENTS_DIR)) return [];
    return fs.readdirSync(STUDENTS_DIR)
        .filter((d) => fs.statSync(path.join(STUDENTS_DIR, d)).isDirectory());
};


const listUniformDirs = () => {
    if (!fs.existsSync(UNIFORMS_DIR)) return [];
    return fs.readdirSync(UNIFORMS_DIR)
        .filter((d) => fs.statSync(path.join(UNIFORMS_DIR, d)).isDirectory());
};


const buildStudentsPayload = () => {
    const mapPath = path.join(REPO_ROOT, 'assets', 'STUDENTS_MAP.json');
    let map = null;
    if (fs.existsSync(mapPath)) {
        try {
            map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
        } catch (e) {
            console.warn(`[seed-assets] STUDENTS_MAP.json invalido: ${e.message}`);
        }
    }
    const byFolder = {};
    if (map && Array.isArray(map.students)) {
        for (const s of map.students) byFolder[s.folder] = s;
    }
    const dirs = listStudentDirs();
    const payload = [];
    for (const folder of dirs) {
        const images = listImages(path.join(STUDENTS_DIR, folder));
        if (images.length < 3) {
            console.warn(`  [WARN] ${folder}: solo ${images.length} imagenes (minimo 3). Omitido.`);
            continue;
        }
        const meta = byFolder[folder];
        if (!meta) {
            console.warn(`  [WARN] ${folder}: sin entrada en STUDENTS_MAP.json. Omitido.`);
            continue;
        }
        payload.push({
            idCard: meta.idCard,
            studentName: meta.studentName,
            studentSurname: meta.studentSurname || '',
            email: meta.email || `${folder}@kinal.edu.gt`,
            grade: meta.grade || '6TO',
            imagePaths: images,
        });
    }
    return payload;
};


const buildUniformsPayload = () => {
    const payload = [];
    for (const top of listUniformDirs()) {
        const topPath = path.join(UNIFORMS_DIR, top);
        if (top === 'tshirt' || top === 'shirts') {
            const images = listImages(topPath);
            if (images.length > 0) {
                payload.push({
                    name: `camisa_oficial_${top}`,
                    type: 'TSHIRT',
                    imagePaths: images,
                    estado: null,
                    marca: top,
                });
            }
            continue;
        }
        for (const estado of fs.readdirSync(topPath)) {
            const sub = path.join(topPath, estado);
            if (!fs.statSync(sub).isDirectory()) continue;
            const images = listImages(sub);
            if (images.length === 0) continue;
            payload.push({
                name: `${top}_jacket_${estado}`,
                type: 'JACKET',
                imagePaths: images,
                estado,
                marca: top,
            });
        }
    }
    return payload;
};


const postBulk = async (endpoint, body) => {
    const url = `${ADMIN_BASE_URL}${ADMIN_PATH}${endpoint}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-token': INTERNAL_TOKEN,
        },
        body: JSON.stringify(body),
    });
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    return { status: resp.status, ok: resp.ok, body: json || text };
};


const runSeedAssets = async ({ force = false } = {}) => {
    if (!INTERNAL_TOKEN) {
        console.warn('[seed-assets] INTERNAL_API_TOKEN no definido. Omitido.');
        return { skipped: true, reason: 'no-token' };
    }
    if (mongoose.connection.readyState !== 1) {
        console.warn('[seed-assets] Mongo no conectado. Omitido.');
        return { skipped: true, reason: 'no-mongo' };
    }

    const studentCount = await Student.countDocuments();
    const uniformCount = await Uniform.countDocuments();
    const studentsPayload = buildStudentsPayload();
    const uniformsPayload  = buildUniformsPayload();
    const studentsRequired = studentsPayload.length;
    const uniformsRequired  = uniformsPayload.length;
    const haveAllMongo = (
        studentsRequired > 0 && uniformsRequired > 0 &&
        studentCount >= studentsRequired && uniformCount >= uniformsRequired
    );

    // Tambien consultar ChromaDB en pyimage: si las embeddings no se generaron
    // (caso comun cuando se creo solo Mongo), hay que generarlas aunque Mongo
    // ya tenga los registros. Los controllers /create-bulk son idempotentes.
    let chromaFaces = 0, chromaUniforms = 0;
    try {
        const r = await fetch(`${ADMIN_BASE_URL}${ADMIN_PATH}/chroma-status`, {
            headers: { 'x-internal-token': INTERNAL_TOKEN },
        });
        if (r.ok) {
            const j = await r.json();
            chromaFaces = j.faces || 0;
            chromaUniforms = j.uniforms || 0;
        }
    } catch (e) {
        console.warn(`[seed-assets] no se pudo consultar /chroma-status: ${e.message}`);
    }

    const embeddingsReady = (
        chromaFaces >= studentsRequired && chromaUniforms >= uniformsRequired
    );
    if (!force && haveAllMongo && embeddingsReady) {
        console.log(
            `[seed-assets] Mongo + ChromaDB completos (students=${studentCount}/${studentsRequired}, uniforms=${uniformCount}/${uniformsRequired}, chroma: faces=${chromaFaces}, uniforms=${chromaUniforms}). Omitido.`
        );
        return { skipped: true, reason: 'already-complete', studentCount, uniformCount, chromaFaces, chromaUniforms };
    }
    console.log(
        `[seed-assets] Estado: Mongo students=${studentCount}/${studentsRequired} uniforms=${uniformCount}/${uniformsRequired} | ChromaDB faces=${chromaFaces} uniforms=${chromaUniforms}. Procesando.`
    );

    console.log('[seed-assets] Iniciando seed de assets (estudiantes + uniformes)...');

    console.log(`[seed-assets] Estudiantes a procesar: ${studentsPayload.length}`);
    if (studentsPayload.length > 0) {
        const r = await postBulk('/students/create-bulk', { students: studentsPayload });
        console.log(`[seed-assets] /students/create-bulk -> ${r.status}`, r.body);
    }

    console.log(`[seed-assets] Uniformes a procesar: ${uniformsPayload.length}`);
    if (uniformsPayload.length > 0) {
        const r = await postBulk('/uniforms/create-bulk', { uniforms: uniformsPayload });
        console.log(`[seed-assets] /uniforms/create-bulk -> ${r.status}`, r.body);
    }

    console.log('[seed-assets] OK');
    return { skipped: false };
};


const main = async () => {
    const force = process.argv.includes('--force');
    console.log('='.repeat(65));
    console.log(`  SEED ASSETS${force ? ' (FORZADO)' : ''}`);
    console.log('='.repeat(65));
    await dbConnection();
    const result = await runSeedAssets({ force });
    await mongoose.disconnect();
    if (result.skipped) {
        console.log(`Omitido (${result.reason}).`);
    } else {
        console.log('COMPLETADO.');
    }
    process.exit(0);
};

const isInvokedDirectly = process.argv[1] && (
    process.argv[1].endsWith('seed-assets.js') ||
    process.argv[1] === __filename
);

if (isInvokedDirectly) {
    main().catch((e) => {
        console.error('FATAL:', e);
        process.exit(1);
    });
}

export default runSeedAssets;

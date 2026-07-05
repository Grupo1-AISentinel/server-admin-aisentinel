import axios from 'axios';
import Student from './student.model.js';

const fetchImageBuffer = async (url) => {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    return Buffer.from(response.data);
};

export const createStudent = async (req, res, next) => {
    try {
        const studentData = req.body;

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren al menos 3 imágenes para el estudiante',
            });
        }

        // Si es coordinador, solo puede crear estudiantes de su propio grado
        if (req.coordinatorGrade && studentData.grade !== req.coordinatorGrade) {
            return res.status(403).json({
                success: false,
                message: `Como coordinador solo puede crear estudiantes del grado ${req.coordinatorGrade}.`,
            });
        }

        const student = new Student({
            studentName: studentData.studentName,
            studentSurname: studentData.studentSurname,
            email: studentData.email,
            idCard: studentData.idCard,
            grade: studentData.grade
        });
        await student.save();

        const { default: pyimageClient } = await import('../../utils/pyimage-client.js');

        const fotos = [];
        for (const file of req.files) {
            try {
                const buffer = await fetchImageBuffer(file.path);
                fotos.push({ buffer, mimetype: file.mimetype });
            } catch (downloadErr) {
                console.warn(`[students] no se pudo descargar ${file.path} para generar el embedding: ${downloadErr.message}`);
            }
        }

        try {
            const result = await pyimageClient.registerStudent({
                carnet: req.body.idCard,
                nombre: `${req.body.studentName} ${req.body.studentSurname}`,
                fotos,
            });
            if (!result || result.status !== 'success') {
                console.warn(`[students] pyimage no genero el embedding para ${req.body.idCard}: ${result?.message}`);
            }
        } catch (pyErr) {
            console.warn(`[students] pyimage register fallo (continúa): ${pyErr.message}`);
        }

        res.status(201).json({
            success: true,
            message: 'Estudiante creado exitosamente',
            data: student,
        });
    } catch (error) {
        next(error);
    }
}

export const getStudents = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, isActive } = req.query;

        const parsedPage  = parseInt(page);
        const parsedLimit = parseInt(limit);
        const filter = {};
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (req.coordinatorGrade) filter.grade = req.coordinatorGrade;

        const students = await Student.find(filter)
            .limit(parsedLimit)
            .skip((parsedPage - 1) * parsedLimit)
            .sort({ createdAt: -1 });

        const total = await Student.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: students,
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

// Obtener Estudiante por ID
export const getStudentById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado',
            });
        }

        if (req.coordinatorGrade && student.grade !== req.coordinatorGrade) {
            return res.status(403).json({
                success: false,
                message: `Solo puede consultar estudiantes del grado ${req.coordinatorGrade}.`,
            });
        }

        res.status(200).json({
            success: true,
            data: student,
        });
    } catch (error) {
        next(error);
    }
};

// Actualizar estudiante
export const updateStudent = async (req, res, next) => {
    try {
        const { id } = req.params;

        const currentStudent = await Student.findById(id);
        if (!currentStudent) {
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado',
            });
        }

        const updateData = { ...req.body };

   

        const updatedStudent = await Student.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            success: true,
            message: 'Estudiante actualizado exitosamente',
            data: updatedStudent,
        });
    } catch (error) {
        next(error);
    }
};

// Activar estudiante
export const activateStudent = async (req, res, next) => {
    try {
        const { id } = req.params;

        const student = await Student.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Estudiante activado exitosamente',
            data: student   ,
        });
    } catch (error) {
        next(error);
    }
};

// Desactivar estudiante
export const deactivateStudent = async (req, res, next) => {
    try {
        const { id } = req.params;

        const student = await Student.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Estudiante desactivado exitosamente',
            data: student,
        });
    } catch (error) {
        next(error);
    }
};

// Eliminar estudiante (hard delete)
export const deleteStudent = async (req, res, next) => {
    try {
        const { id } = req.params;

        const student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado',
            });
        }

        await Student.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Estudiante eliminado exitosamente',
        });
    } catch (error) {
        next(error);
    }
    
};


// Obtener estudiante por carnet
export const getStudentByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const student = await Student.findOne({ idCard });
        if (!student) return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        if (req.coordinatorGrade && student.grade !== req.coordinatorGrade) {
            return res.status(403).json({ success: false, message: `Solo puede consultar estudiantes del grado ${req.coordinatorGrade}.` });
        }
        res.status(200).json({ success: true, data: student });
    } catch (error) { next(error); }
};

// Actualizar estudiante por carnet
export const updateStudentByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const currentStudent = await Student.findOne({ idCard });
        if (!currentStudent) return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });

        const updateData = { ...req.body };
      

        const updatedStudent = await Student.findOneAndUpdate({ idCard }, updateData, { new: true, runValidators: true });
        res.status(200).json({ success: true, message: 'Estudiante actualizado exitosamente', data: updatedStudent });
    } catch (error) { next(error); }
};

// Activar estudiante por carnet
export const activateStudentByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const student = await Student.findOneAndUpdate({ idCard }, { isActive: true }, { new: true });
        if (!student) return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        res.status(200).json({ success: true, message: 'Estudiante activado exitosamente', data: student });
    } catch (error) { next(error); }
};

// Desactivar estudiante por carnet
export const deactivateStudentByIdCard = async (req, res, next) => {
    try {        const { idCard } = req.params;
        const student = await Student
        .findOneAndUpdate({ idCard }, { isActive: false }, { new: true });
        if (!student) return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        res.status(200).json({ success: true, message: 'Estudiante desactivado exitosamente', data: student });
    } catch (error) { next(error); }
};
// Eliminar estudiante por carnet
export const deleteStudentByIdCard = async (req, res, next) => {
    try {
        const { idCard } = req.params;
        const student = await Student.findOne({ idCard });
        if (!student) return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        await Student.findOneAndDelete({ idCard });
        res.status(200).json({ success: true, message: 'Estudiante eliminado exitosamente' });
    } catch (error) { next(error); }
};

export const autoSyncStudents = async (req, res, next) => {
    try {
        const studentsList = req.body; 
        let newlyCreated = 0;

        for (const i of studentsList) {
            const exists = await Student.findOne({ idCard: i.idCard });

            if (!exists) {
                const newStudent = new Student({
                    studentName: i.studentName,
                    studentSurname: i.studentSurname,
                    idCard: i.idCard,
                    email: i.email,
                    grade: i.grade,
                    isActive: true 
                });
                await newStudent.save();
                newlyCreated++;
            }
        }

        res.status(200).json({
            success: true,
            message: 'Sincronización completada exitosamente',
            newlyCreated: newlyCreated,
            totalProcessed: studentsList.length
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Crea multiples estudiantes de una sola vez (usado por helpers/seed-assets.js).
 * Body (JSON): { students: [{ idCard, studentName, studentSurname, email, grade, imagePaths: [absPath1, ...] }] }
 * Auth: x-internal-token (no JWT, no rol).
 *
 * Por cada estudiante: crea en Mongo, lee los archivos locales, los envia
 * a pyimage para generar embeddings faciales, igual que createStudent.
 * Skip silencioso si el idCard ya existe.
 */
export const createStudentsBulk = async (req, res, next) => {
    const fs = await import('fs');
    const { default: pyimageClient } = await import('../../utils/pyimage-client.js');

    const students = Array.isArray(req.body?.students) ? req.body.students : [];
    const results = { created: 0, skipped: 0, embeddings: 0, failed: 0, errors: [] };

    for (const s of students) {
        try {
            if (!s.idCard || !s.studentName) {
                results.failed += 1;
                results.errors.push({ idCard: s.idCard, error: 'idCard y studentName son requeridos' });
                continue;
            }
            const imagePaths = Array.isArray(s.imagePaths) ? s.imagePaths : [];
            if (imagePaths.length < 3) {
                results.failed += 1;
                results.errors.push({ idCard: s.idCard, error: 'minimo 3 imagenes' });
                continue;
            }
            const fotos = [];
            for (const p of imagePaths) {
                const buf = fs.readFileSync(p);
                fotos.push({ buffer: buf, mimetype: 'image/jpeg' });
            }

            const exists = await Student.findOne({ idCard: s.idCard });
            if (!exists) {
                await Student.create({
                    studentName: s.studentName,
                    studentSurname: s.studentSurname || '',
                    email: s.email,
                    idCard: s.idCard,
                    grade: s.grade || '6TO',
                });
                results.created += 1;
            } else {
                results.skipped += 1;
            }

            // SIEMPRE enviar las fotos a pyimage para generar embeddings faciales,
            // aunque el Student ya exista en Mongo. save_student_vector hace upsert
            // (no duplica). Esto resuelve el caso donde el auto-sync Mongo de pyimage
            // creo los docs pero los embeddings ChromaDB nunca se generaron.
            try {
                const r = await pyimageClient.registerStudent({
                    carnet: s.idCard,
                    nombre: `${s.studentName} ${s.studentSurname || ''}`.trim(),
                    fotos,
                });
                if (r && r.status === 'success') results.embeddings += 1;
                else if (r && r.message) console.warn(`[students-bulk] ${s.idCard}: ${r.message}`);
            } catch (pyErr) {
                console.warn(`[students-bulk] pyimage fallo para ${s.idCard}: ${pyErr.message}`);
            }
        } catch (e) {
            results.failed += 1;
            results.errors.push({ idCard: s.idCard, error: e.message });
        }
    }

    res.status(200).json({ success: true, ...results });
};
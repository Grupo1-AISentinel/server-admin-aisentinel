import Student from '../students/student.model.js';
import { generateStatsPDFBuffer } from '../../utils/pdf-generator.js';
import { sendEmailWithAttachment } from '../../utils/email-generator.js';

const objectsStatistics = [
    { object: 'JACKET', totalInfractions: 23 },
    { object: 'SHIRT', totalInfractions: 17 },
    { object: 'PANT', totalInfractions: 12 },
    { object: 'ACCESORY', totalInfractions: 9 }
];

const daysStatistics = [
    { day: 'Lunes', totalInfractions: 21 },
    { day: 'Martes', totalInfractions: 18 },
    { day: 'Miércoles', totalInfractions: 26 },
    { day: 'Jueves', totalInfractions: 17 },
    { day: 'Viernes', totalInfractions: 24 }
];

const gradesStatistics = [
    { grade: '1RO', totalInfractions: 21 },
    { grade: '2DO', totalInfractions: 18 },
    { grade: '3RO', totalInfractions: 26 },
    { grade: '4TO', totalInfractions: 17 },
    { grade: '5TO', totalInfractions: 24 },
    { grade: '6TO', totalInfractions: 14 }
];

const studentsStatistics = [
    { studentName: 'Juan', studentSurname: 'Perez', idCard: '2026001', grade: '1RO', infractions: 8 },
    { studentName: 'Ana', studentSurname: 'Lopez', idCard: '2026002', grade: '2DO', infractions: 7 },
    { studentName: 'Luis', studentSurname: 'Garcia', idCard: '2026003', grade: '3RO', infractions: 6 },
    { studentName: 'Maria', studentSurname: 'Ramirez', idCard: '2026004', grade: '4TO', infractions: 5 },
    { studentName: 'Carlos', studentSurname: 'Mendez', idCard: '2026005', grade: '5TO', infractions: 4 },
    { studentName: 'Sofia', studentSurname: 'Hernandez', idCard: '2026006', grade: '6TO', infractions: 3 }
];



export const getGradesStatistics = async (req, res, next) => {
    try {
        const dbStats = await Student.aggregate([
            { $match: { infractions: { $gt: 0 } } },
            {
                $group: {
                    _id: '$grade',
                    totalInfractions: { $sum: '$infractions' }
                }
            },
            { $sort: { totalInfractions: -1 } }
        ]);

        const stats = dbStats.length > 0
            ? dbStats
            : gradesStatistics.map((item) => ({
                _id: item.grade,
                totalInfractions: item.totalInfractions
            }));

        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

export const exportGradesStatistics = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'El correo de destino es requerido' });
        }

        const dbStats = await Student.aggregate([
            { $match: { infractions: { $gt: 0 } } },
            { $group: { _id: '$grade', totalInfractions: { $sum: '$infractions' } } },
            { $sort: { totalInfractions: -1 } }
        ]);

        //if (stats.length === 0) {
           // return res.status(404).json({ success: false, message: 'No hay grados con infracciones registradas para generar el reporte.' });
        //}
        const stats = dbStats.length > 0
            ? dbStats
            : gradesStatistics.map((item) => ({
                _id: item.grade,
                totalInfractions: item.totalInfractions
            }));

        // Configuración visual para la tabla de Grados
        const headers = ['', 'Grado', 'Infracciones'];
        const widthsCm = [1.5, 6, 3]; // Mismas proporciones adaptadas
        const rows = stats.map((stat, index) => [
            index + 1,
            stat._id,
            stat.totalInfractions
        ]);

        const pdfBuffer = await generateStatsPDFBuffer('Grados con más infracciones', headers, widthsCm, rows);
        await sendEmailWithAttachment(email, 'Reporte AISentinel - Grados', 'Adjunto encontrarás el reporte de grados con más infracciones.', pdfBuffer, 'reporte_grados.pdf');

        res.status(200).json({ success: true, message: `Reporte enviado exitosamente a: ${email}` });
    } catch (error) {
        next(error);
    }
};

export const getStudentsStatistics = async (req, res, next) => {
    try {
        const dbTopStudents = await Student.find({ isActive: true, infractions: { $gt: 0 } })
            .sort({ infractions: -1 })
            .limit(10)
            .select('studentName studentSurname idCard grade infractions');

        const topStudents = dbTopStudents.length > 0 ? dbTopStudents : studentsStatistics;

        res.status(200).json({ success: true, data: topStudents });
    } catch (error) {
        next(error);
    }
};

export const exportStudentsStatistics = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'El correo de destino es requerido' });
        }

        const dbTopStudents = await Student.find({ isActive: true, infractions: { $gt: 0 } })
            .sort({ infractions: -1 })
            .limit(10)
            .select('studentName studentSurname idCard grade infractions');

        const topStudents = dbTopStudents.length > 0 ? dbTopStudents : studentsStatistics;

        // Configuración visual exacta para la tabla de Estudiantes
        const headers = ['', 'Alumno', 'Carnet', 'Grado', 'Infracciones'];
        const widthsCm = [1.5, 6, 2.75, 2.5, 3];
        const rows = topStudents.map((student, index) => [
            index + 1,
            `${student.studentSurname}, ${student.studentName}`,
            student.idCard,
            student.grade,
            student.infractions
        ]);

        const pdfBuffer = await generateStatsPDFBuffer('Top 10 estudiantes con más infracciones', headers, widthsCm, rows);
        await sendEmailWithAttachment(email, 'Reporte AISentinel - Estudiantes', 'Adjunto encontrarás el reporte de los estudiantes con más infracciones.', pdfBuffer, 'reporte_estudiantes.pdf');

        res.status(200).json({ success: true, message: `Reporte enviado exitosamente a: ${email}` });
    } catch (error) {
        next(error);
    }
};

export const getObjectsStatistics = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: objectsStatistics });
    } catch (error) {
        next(error);
    }
};

export const exportObjectsStatistics = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'El correo de destino es requerido' });
        }

        if (objectsStatistics.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay objetos con infracciones registradas para generar el reporte.' });
        }

        const headers = ['', 'Objeto', 'Infracciones'];
        const widthsCm = [1.5, 6, 3];
        const rows = objectsStatistics.map((stat, index) => [
            index + 1,
            stat.object,
            stat.totalInfractions
        ]);

        const pdfBuffer = await generateStatsPDFBuffer('Objetos con más incidencias', headers, widthsCm, rows);
        await sendEmailWithAttachment(email, 'Reporte AISentinel - Objetos', 'Adjunto encontrarás el reporte de objetos con más incidencias.', pdfBuffer, 'reporte_objetos.pdf');

        res.status(200).json({ success: true, message: `Reporte enviado exitosamente a: ${email}` });
    } catch (error) {
        next(error);
    }
};

export const getDaysStatistics = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: daysStatistics });
    } catch (error) {
        next(error);
    }
};

export const exportDaysStatistics = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'El correo de destino es requerido' });
        }

        if (daysStatistics.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay días con incidencias registradas para generar el reporte.' });
        }

        const headers = ['', 'Día', 'Infracciones'];
        const widthsCm = [1.5, 6, 3];
        const rows = daysStatistics.map((stat, index) => [
            index + 1,
            stat.day,
            stat.totalInfractions
        ]);

        const pdfBuffer = await generateStatsPDFBuffer('Infracciones por día', headers, widthsCm, rows);
        await sendEmailWithAttachment(email, 'Reporte AISentinel - Días', 'Adjunto encontrarás el reporte de infracciones por día.', pdfBuffer, 'reporte_dias.pdf');

        res.status(200).json({ success: true, message: `Reporte enviado exitosamente a: ${email}` });
    } catch (error) {
        next(error);
    }
};
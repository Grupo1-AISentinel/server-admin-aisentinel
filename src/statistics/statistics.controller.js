import Student from '../students/student.model.js';
import { generateStatsPDFBuffer } from '../../utils/pdf-generator.js';
import { sendEmailWithAttachment } from '../../utils/email-generator.js';

export const getGradesStatistics = async (req, res, next) => {
    try {
        const stats = await Student.aggregate([
            { $match: { infractions: { $gt: 0 } } },
            {
                $group: {
                    _id: '$grade',
                    totalInfractions: { $sum: '$infractions' }
                }
            },
            { $sort: { totalInfractions: -1 } }
        ]);

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

        const stats = await Student.aggregate([
            { $match: { infractions: { $gt: 0 } } },
            { $group: { _id: '$grade', totalInfractions: { $sum: '$infractions' } } },
            { $sort: { totalInfractions: -1 } }
        ]);

        if (stats.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay grados con infracciones registradas para generar el reporte.' });
        }

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
        const topStudents = await Student.find({ isActive: true, infractions: { $gt: 0 } })
            .sort({ infractions: -1 })
            .limit(10)
            .select('studentName studentSurname idCard grade infractions');

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

        const topStudents = await Student.find({ isActive: true, infractions: { $gt: 0 } })
            .sort({ infractions: -1 })
            .limit(10)
            .select('studentName studentSurname idCard grade infractions');

        if (topStudents.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay estudiantes con infracciones registradas para generar el reporte.' });
        }

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
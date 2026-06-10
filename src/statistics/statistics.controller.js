import Student from '../students/student.model.js';
import Alert from '../alerts/alerts.model.js';
import { generateStatsPDFBuffer } from '../../utils/pdf-generator.js';
import { generateStatsExcelBuffer } from '../../utils/excel-generator.js';
import { sendEmailWithAttachment } from '../../utils/email-generator.js';

const buildBuffer = async (format, title, headers, rows, excelOptions = {}) => {
    if (format === 'excel') {
        const buffer = await generateStatsExcelBuffer(title, headers, rows, excelOptions);
        return {
            buffer,
            contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `${title.toLowerCase().replace(/\s+/g, '_')}.xlsx`,
        };
    }
    const widthsCm = headers.map((h, i) =>
        i === 0 ? 1.5 : Math.max(3, String(h).length * 0.6)
    );
    const buffer = await generateStatsPDFBuffer(title, headers, widthsCm, rows);
    return {
        buffer,
        contentType: 'application/pdf',
        filename: `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
    };
};

const respondWithFile = (res, file) => {
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.buffer.length);
    res.send(file.buffer);
};

const gradeLabels = {
    '1RO': '1ro. Básico',
    '2DO': '2do. Básico',
    '3RO': '3ro. Básico',
    '4TO': '4to. Básico',
    '5TO': '5to. Básico',
    '6TO': '6to. Básico',
};

export const getGradesStatistics = async (req, res, next) => {
    try {
        const stats = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'student',
                },
            },
            { $unwind: '$student' },
            {
                $group: {
                    _id: '$student.grade',
                    totalInfractions: { $sum: '$infractionCount' },
                    studentCount: { $addToSet: '$studentCard' },
                },
            },
            {
                $project: {
                    totalInfractions: 1,
                    studentCount: { $size: '$studentCount' },
                },
            },
            { $sort: { totalInfractions: -1 } },
        ]);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

export const exportGradesStatistics = async (req, res, next) => {
    try {
        const {
            email = null,
            format = 'pdf',
            sections = { index: true, grade: true, students: true, total: true },
        } = req.body || {};

        const dbStats = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'studentDetail',
                },
            },
            { $unwind: '$studentDetail' },
            {
                $group: {
                    _id: '$studentDetail.grade',
                    totalInfractions: { $sum: '$infractionCount' },
                    studentCount: { $addToSet: '$studentCard' },
                },
            },
            {
                $project: {
                    totalInfractions: 1,
                    studentCount: { $size: '$studentCount' },
                },
            },
            { $sort: { totalInfractions: -1 } },
        ]);

        if (dbStats.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: 'No hay alertas registradas para generar el reporte de grados.' });
        }

        const allHeaders = ['#', 'Grado', 'Estudiantes', 'Infracciones'];
        const headerMap = { index: '#', grade: 'Grado', students: 'Estudiantes', total: 'Infracciones' };
        const headers = allHeaders.filter((h) =>
            Object.entries(headerMap).some(([k, label]) => label === h && sections[k])
        );
        const sectionKeys = headers.map((h) =>
            Object.entries(headerMap).find(([, label]) => label === h)[0]
        );
        const rows = dbStats.map((stat, idx) => {
            const full = [
                idx + 1,
                gradeLabels[stat._id] || stat._id,
                stat.studentCount,
                stat.totalInfractions,
            ];
            return sectionKeys.map((key) => {
                if (key === 'index') return idx + 1;
                if (key === 'grade') return gradeLabels[stat._id] || stat._id;
                if (key === 'students') return stat.studentCount;
                if (key === 'total') return stat.totalInfractions;
                return '';
            });
        });

        const file = await buildBuffer(
            format,
            'Reporte Grados con mas Infracciones',
            headers,
            rows,
            { columnWidths: headers.map((h) => (h === '#' ? 6 : 22)) }
        );

        if (email) {
            await sendEmailWithAttachment(
                email,
                'Reporte AISentinel - Grados con más infracciones',
                'Adjunto encontrarás el reporte basado en las detecciones registradas por el sistema de visión.',
                file.buffer,
                file.filename
            );
            return res
                .status(200)
                .json({ success: true, message: `Reporte enviado a: ${email}` });
        }

        return respondWithFile(res, file);
    } catch (error) {
        console.error('Error al exportar grados:', error);
        next(error);
    }
};

export const getStudentsStatistics = async (req, res, next) => {
    try {
        const topStudents = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'info',
                },
            },
            { $unwind: '$info' },
            {
                $group: {
                    _id: '$studentCard',
                    studentName: { $first: '$info.studentName' },
                    studentSurname: { $first: '$info.studentSurname' },
                    idCard: { $first: '$info.idCard' },
                    grade: { $first: '$info.grade' },
                    infractions: { $sum: '$infractionCount' },
                },
            },
            { $sort: { infractions: -1 } },
            { $limit: 50 },
        ]);

        res.status(200).json({
            success: true,
            totalResults: topStudents.length,
            data: topStudents,
        });
    } catch (error) {
        next(error);
    }
};

export const exportStudentsStatistics = async (req, res, next) => {
    try {
        const {
            email = null,
            format = 'pdf',
            sections = { index: true, name: true, card: true, grade: true, total: true },
        } = req.body || {};

        const topStudents = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'studentInfo',
                },
            },
            { $unwind: '$studentInfo' },
            {
                $group: {
                    _id: '$studentCard',
                    name: { $first: '$studentInfo.studentName' },
                    surname: { $first: '$studentInfo.studentSurname' },
                    grade: { $first: '$studentInfo.grade' },
                    totalInfractions: { $sum: '$infractionCount' },
                },
            },
            { $sort: { totalInfractions: -1 } },
            { $limit: 10 },
        ]);

        if (topStudents.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: 'No hay infracciones registradas.' });
        }

        const headerMap = {
            index: '#',
            name: 'Alumno',
            card: 'Carnet',
            grade: 'Grado',
            total: 'Infracciones',
        };
        const headers = Object.entries(headerMap)
            .filter(([k]) => sections[k])
            .map(([, label]) => label);

        const rows = topStudents.map((student, idx) => {
            const full = [
                idx + 1,
                `${student.surname}, ${student.name}`,
                student._id,
                gradeLabels[student.grade] || student.grade,
                student.totalInfractions,
            ];
            return Object.entries(headerMap)
                .filter(([k]) => sections[k])
                .map(([k]) => {
                    if (k === 'index') return idx + 1;
                    if (k === 'name') return `${student.surname}, ${student.name}`;
                    if (k === 'card') return student._id;
                    if (k === 'grade') return gradeLabels[student.grade] || student.grade;
                    if (k === 'total') return student.totalInfractions;
                    return '';
                });
        });

        const file = await buildBuffer(
            format,
            'Reporte Top 10 Estudiantes con mas Infracciones',
            headers,
            rows,
            { columnWidths: headers.map((h) => (h === '#' ? 6 : 22)) }
        );

        if (email) {
            await sendEmailWithAttachment(
                email,
                'Reporte AISentinel - Ranking de Estudiantes',
                'Adjunto el reporte de los estudiantes con mayor índice de infracciones.',
                file.buffer,
                file.filename
            );
            return res
                .status(200)
                .json({ success: true, message: `Reporte enviado a: ${email}` });
        }

        return respondWithFile(res, file);
    } catch (error) {
        console.error('Error al exportar estudiantes:', error);
        next(error);
    }
};

export const getObjectsStatistics = async (req, res, next) => {
    try {
        const totalUniforme = await Alert.countDocuments({ reason: 'UNIFORME_INCOMPLETO' });
        const totalAccesorios = await Alert.countDocuments({ reason: 'ACCESORIO_NO_PERMITIDO' });

        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        const hoyUniforme = await Alert.countDocuments({
            reason: 'UNIFORME_INCOMPLETO',
            lastDetection: { $gte: inicioDia },
        });

        const hoyAccesorios = await Alert.countDocuments({
            reason: 'ACCESORIO_NO_PERMITIDO',
            lastDetection: { $gte: inicioDia },
        });

        const statistics = {
            totals: {
                uniformeIncompleto: totalUniforme,
                accesoriosNoPermitidos: totalAccesorios,
                totalAlertas: totalUniforme + totalAccesorios,
            },
            today: {
                uniformeIncompleto: hoyUniforme,
                accesoriosNoPermitidos: hoyAccesorios,
            },
            labels: ['Uniforme Incompleto', 'Accesorios'],
            series: [totalUniforme, totalAccesorios],
        };

        res.status(200).json({ success: true, data: statistics });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        next(error);
    }
};

export const exportObjectsStatistics = async (req, res, next) => {
    try {
        const {
            email = null,
            format = 'pdf',
            sections = { index: true, reason: true, total: true, today: true },
        } = req.body || {};

        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        const [totalUniforme, totalAccesorios, hoyUniforme, hoyAccesorios] = await Promise.all([
            Alert.countDocuments({ reason: 'UNIFORME_INCOMPLETO' }),
            Alert.countDocuments({ reason: 'ACCESORIO_NO_PERMITIDO' }),
            Alert.countDocuments({
                reason: 'UNIFORME_INCOMPLETO',
                lastDetection: { $gte: inicioDia },
            }),
            Alert.countDocuments({
                reason: 'ACCESORIO_NO_PERMITIDO',
                lastDetection: { $gte: inicioDia },
            }),
        ]);

        if (totalUniforme === 0 && totalAccesorios === 0) {
            return res
                .status(404)
                .json({ success: false, message: 'No hay infracciones registradas.' });
        }

        const dataRows = [
            {
                index: 1,
                reason: 'Uniforme Incompleto',
                total: totalUniforme,
                today: hoyUniforme,
            },
            {
                index: 2,
                reason: 'Accesorios No Permitidos',
                total: totalAccesorios,
                today: hoyAccesorios,
            },
            {
                index: '—',
                reason: 'TOTAL',
                total: totalUniforme + totalAccesorios,
                today: hoyUniforme + hoyAccesorios,
            },
        ];

        const headerMap = {
            index: '#',
            reason: 'Tipo de Infracción',
            total: 'Total Detectado',
            today: 'Hoy',
        };
        const headers = Object.entries(headerMap)
            .filter(([k]) => sections[k])
            .map(([, label]) => label);
        const rows = dataRows.map((r) =>
            Object.entries(headerMap)
                .filter(([k]) => sections[k])
                .map(([k]) => r[k])
        );

        const file = await buildBuffer(
            format,
            'Reporte Tipos de Infraccion',
            headers,
            rows,
            { columnWidths: headers.map((h) => (h === '#' ? 6 : 26)) }
        );

        if (email) {
            await sendEmailWithAttachment(
                email,
                'Reporte AISentinel - Tipos de Infracción',
                'Adjunto el reporte de los tipos de infracciones detectadas.',
                file.buffer,
                file.filename
            );
            return res
                .status(200)
                .json({ success: true, message: `Reporte enviado a: ${email}` });
        }

        return respondWithFile(res, file);
    } catch (error) {
        console.error('Error al exportar tipos de infracción:', error);
        next(error);
    }
};

export const getDaysStatistics = async (req, res, next) => {
    try {
        const stats = await Alert.aggregate([
            {
                $project: {
                    dayOfWeek: { $dayOfWeek: '$lastDetection' },
                    infractionCount: 1,
                },
            },
            {
                $group: {
                    _id: '$dayOfWeek',
                    totalInfractions: { $sum: '$infractionCount' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const days = {
            1: 'Domingo',
            2: 'Lunes',
            3: 'Martes',
            4: 'Miércoles',
            5: 'Jueves',
            6: 'Viernes',
            7: 'Sábado',
        };

        const formattedData = stats.map((item) => ({
            day: days[item._id],
            totalInfractions: item.totalInfractions,
        }));

        const fullWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(
            (d) => {
                const found = formattedData.find((f) => f.day === d);
                return found || { day: d, totalInfractions: 0 };
            }
        );

        res.status(200).json({ success: true, data: fullWeek });
    } catch (error) {
        next(error);
    }
};

export const exportDaysStatistics = async (req, res, next) => {
    try {
        const {
            email = null,
            format = 'pdf',
            sections = { index: true, day: true, total: true },
        } = req.body || {};

        const stats = await Alert.aggregate([
            {
                $project: {
                    dayOfWeek: { $dayOfWeek: '$lastDetection' },
                    infractionCount: 1,
                },
            },
            {
                $group: {
                    _id: '$dayOfWeek',
                    totalInfractions: { $sum: '$infractionCount' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        if (stats.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: 'No hay infracciones registradas.' });
        }

        const days = {
            1: 'Domingo', 2: 'Lunes', 3: 'Martes', 4: 'Miércoles',
            5: 'Jueves', 6: 'Viernes', 7: 'Sábado',
        };

        const headerMap = { index: '#', day: 'Día de la Semana', total: 'Total Infracciones' };
        const headers = Object.entries(headerMap)
            .filter(([k]) => sections[k])
            .map(([, label]) => label);
        const rows = stats.map((stat, idx) =>
            Object.entries(headerMap)
                .filter(([k]) => sections[k])
                .map(([k]) => {
                    if (k === 'index') return idx + 1;
                    if (k === 'day') return days[stat._id];
                    if (k === 'total') return stat.totalInfractions;
                    return '';
                })
        );

        const file = await buildBuffer(
            format,
            'Reporte Distribucion por Dia de la Semana',
            headers,
            rows,
            { columnWidths: headers.map((h) => (h === '#' ? 6 : 24)) }
        );

        if (email) {
            await sendEmailWithAttachment(
                email,
                'Reporte AISentinel - Análisis Semanal',
                'Adjunto el análisis de infracciones distribuido por día de la semana.',
                file.buffer,
                file.filename
            );
            return res
                .status(200)
                .json({ success: true, message: `Reporte enviado a: ${email}` });
        }

        return respondWithFile(res, file);
    } catch (error) {
        console.error('Error al exportar días:', error);
        next(error);
    }
};

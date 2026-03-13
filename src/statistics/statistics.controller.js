import Student from '../students/student.model.js';
import Alert from '../alerts/alerts.model.js';
import { generateStatsPDFBuffer } from '../../utils/pdf-generator.js';
import { sendEmailWithAttachment } from '../../utils/email-generator.js';

export const getGradesStatistics = async (req, res, next) => {
    try {
        const stats = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students', 
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'student'
                }
            },
            { $unwind: '$student' },
            {
                $group: {
                    _id: '$student.grade',
                    totalInfractions: { $sum: '$infractionCount' }
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

        const dbStats = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students',        
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'studentDetail'
                }
            },
            { $unwind: '$studentDetail' },   
            {
                $group: {
                    _id: '$studentDetail.grade',
                    totalInfractions: { $sum: '$infractionCount' }
                }
            },
            { $sort: { totalInfractions: -1 } }
        ]);

        if (dbStats.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No hay alertas registradas para generar el reporte de grados.' 
            });
        }

        const headers = ['', 'Grado', 'Total Infracciones'];
        const widthsCm = [1.5, 6, 4]; 
        const rows = dbStats.map((stat, index) => [
            index + 1,
            stat._id,                
            stat.totalInfractions    
        ]);

        const pdfBuffer = await generateStatsPDFBuffer(
            'Reporte: Grados con más infracciones detectadas', 
            headers, 
            widthsCm, 
            rows
        );

        await sendEmailWithAttachment(
            email, 
            'Reporte AISentinel - Grados (Datos Reales)', 
            'Adjunto encontrarás el reporte de grados basado en las detecciones de la cámara.', 
            pdfBuffer, 
            'reporte_grados_reales.pdf'
        );

        res.status(200).json({ 
            success: true, 
            message: `Reporte real enviado exitosamente a: ${email}` 
        });

    } catch (error) {
        next(error);
    }
};

export const getStudentsStatistics = async (req, res, next) => {
    try {
        const topStudents = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students', // Colección de estudiantes en MongoDB
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'info'
                }
            },
            { $unwind: '$info' }, 
            {
                $group: {
                    _id: '$studentCard',
                    studentName: { $first: '$info.studentName' },
                    studentSurname: { $first: '$info.studentSurname' },
                    idCard: { $first: '$info.idCard' },
                    grade: { $first: '$info.grade' },
                    infractions: { $sum: '$infractionCount' } 
                }
            },
            { $sort: { infractions: -1 } }, // De mayor a menor
            { $limit: 10 } // Solo el Top 10
        ]);

        if (topStudents.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: "No hay infracciones registradas aún.",
                data: [] 
            });
        }

        res.status(200).json({ 
            success: true, 
            totalResults: topStudents.length,
            data: topStudents 
        });
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

        const topStudents = await Alert.aggregate([
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentCard',
                    foreignField: 'idCard',
                    as: 'studentInfo'
                }
            },
            { $unwind: '$studentInfo' },
            {
                $group: {
                    _id: '$studentCard',
                    name: { $first: '$studentInfo.studentName' },
                    surname: { $first: '$studentInfo.studentSurname' },
                    grade: { $first: '$studentInfo.grade' },
                    totalInfractions: { $sum: '$infractionCount' }
                }
            },
            { $sort: { totalInfractions: -1 } },
            { $limit: 10 }
        ]);

        if (topStudents.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No hay infracciones registradas para generar el reporte de estudiantes.' 
            });
        }

        const headers = ['', 'Alumno', 'Carnet', 'Grado', 'Infracciones'];
        const widthsCm = [1.5, 6, 2.75, 2.5, 3];
        
        const rows = topStudents.map((student, index) => [
            index + 1,
            `${student.surname}, ${student.name}`, 
            student._id,                          
            student.grade,
            student.totalInfractions
        ]);

        const pdfBuffer = await generateStatsPDFBuffer(
            'Top 10 Estudiantes con más infracciones detectadas', 
            headers, 
            widthsCm, 
            rows
        );

        await sendEmailWithAttachment(
            email, 
            'Reporte AISentinel - Ranking de Estudiantes', 
            'Adjunto encontrarás el reporte detallado de los estudiantes con mayor índice de infracciones de uniforme.', 
            pdfBuffer, 
            'reporte_estudiantes_real.pdf'
        );

        res.status(200).json({ 
            success: true, 
            message: `Reporte de estudiantes enviado exitosamente a: ${email}` 
        });

    } catch (error) {
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
            lastDetection: { $gte: inicioDia } 
        });
        
        const hoyAccesorios = await Alert.countDocuments({ 
            reason: 'ACCESORIO_NO_PERMITIDO', 
            lastDetection: { $gte: inicioDia } 
        });

        const statistics = {
            totals: {
                uniformeIncompleto: totalUniforme,
                accesoriosNoPermitidos: totalAccesorios,
                totalAlertas: totalUniforme + totalAccesorios
            },
            today: {
                uniformeIncompleto: hoyUniforme,
                accesoriosNoPermitidos: hoyAccesorios
            },
            labels: ['Uniforme Incompleto', 'Accesorios'],
            series: [totalUniforme, totalAccesorios] 
        };

        res.status(200).json({ 
            success: true, 
            data: statistics 
        });
        
    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        next(error);
    }
};

export const exportObjectsStatistics = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'El correo de destino es requerido' });
        }

        const totalUniforme = await Alert.countDocuments({ reason: 'UNIFORME_INCOMPLETO' });
        const totalAccesorios = await Alert.countDocuments({ reason: 'ACCESORIO_NO_PERMITIDO' });

        if (totalUniforme === 0 && totalAccesorios === 0) {
            return res.status(404).json({ success: false, message: 'No hay infracciones registradas para generar el reporte.' });
        }

        const headers = ['#', 'Tipo de Infracción', 'Total Detectado'];
        const widthsCm = [1.5, 7, 4];
        
        const rows = [
            [1, 'Uniforme Incompleto', totalUniforme],
            [2, 'Accesorios No Permitidos', totalAccesorios]
        ];

        const pdfBuffer = await generateStatsPDFBuffer(
            'Reporte de Incidencias - AISentinel', 
            headers, 
            widthsCm, 
            rows
        );

        await sendEmailWithAttachment(
            email, 
            'Reporte AISentinel - Estadísticas de Infracciones', 
            'Adjunto encontrarás el reporte detallado de las infracciones detectadas por el sistema de visión artificial.', 
            pdfBuffer, 
            'reporte_incidencias_sentinel.pdf'
        );

        res.status(200).json({ 
            success: true, 
            message: `Reporte generado con éxito y enviado a: ${email}` 
        });

    } catch (error) {
        console.error("Error al exportar estadísticas:", error);
        next(error);
    }
};

export const getDaysStatistics = async (req, res, next) => {
    try {
        const stats = await Alert.aggregate([
            {
                $project: {
                    dayOfWeek: { $dayOfWeek: "$lastDetection" }, 
                    infractionCount: 1
                }
            },
            {
                $group: {
                    _id: "$dayOfWeek",
                    totalInfractions: { $sum: "$infractionCount" }
                }
            },
            { $sort: { _id: 1 } } 
        ]);

        const days = {
            1: 'Domingo',
            2: 'Lunes',
            3: 'Martes',
            4: 'Miércoles',
            5: 'Jueves',
            6: 'Viernes',
            7: 'Sábado'
        };

        // Formateamos la respuesta para que el Frontend la reciba lista para la gráfica
        const formattedData = stats.map(item => ({
            day: days[item._id],
            totalInfractions: item.totalInfractions
        }));

        const fullWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(d => {
            const found = formattedData.find(f => f.day === d);
            return found || { day: d, totalInfractions: 0 };
        });

        res.status(200).json({ 
            success: true, 
            data: fullWeek 
        });
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

        const stats = await Alert.aggregate([
            {
                $project: {
                    dayOfWeek: { $dayOfWeek: "$lastDetection" },
                    infractionCount: 1
                }
            },
            {
                $group: {
                    _id: "$dayOfWeek",
                    totalInfractions: { $sum: "$infractionCount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        if (stats.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No hay alertas registradas para generar el reporte por días.' 
            });
        }

        const days = {
            1: 'Domingo', 2: 'Lunes', 3: 'Martes', 4: 'Miércoles',
            5: 'Jueves', 6: 'Viernes', 7: 'Sábado'
        };

        const headers = ['', 'Día de la Semana', 'Total Infracciones'];
        const widthsCm = [1.5, 7, 4];
        const rows = stats.map((stat, index) => [
            index + 1,
            days[stat._id],
            stat.totalInfractions
        ]);

        const pdfBuffer = await generateStatsPDFBuffer(
            'Reporte de Infracciones: Distribución por Día', 
            headers, 
            widthsCm, 
            rows
        );

        await sendEmailWithAttachment(
            email, 
            'Reporte AISentinel - Análisis Semanal', 
            'Se adjunta el análisis de infracciones detectadas distribuido por día de la semana.', 
            pdfBuffer, 
            'reporte_analisis_dias.pdf'
        );

        res.status(200).json({ 
            success: true, 
            message: `Reporte de días enviado exitosamente a: ${email}` 
        });

    } catch (error) {
        next(error);
    }
};
import Attendance from '../asistencia/asistencia.model.js';
import Student from '../students/student.model.js';

export const processAutomaticAttendance = async (req, res) => {
    try {
        const { idCard } = req.body; 
        const ahora = new Date();
        const fechaHoy = ahora.toISOString().split('T')[0];

        const estudiante = await Student.findOne({ idCard });
        
        if (!estudiante) {
            console.log(`Intento de acceso con carnet no registrado: ${idCard}`);
            return res.status(404).json({ message: "Estudiante no encontrado" });
        }

        const yaMarco = await Attendance.findOne({ 
            studentCard: idCard, 
            dateStr: fechaHoy 
        });

        if (yaMarco) {
            return res.status(200).json({ 
                message: "Asistencia ya registrada anteriormente",
                student: estudiante.studentName 
            });
        }

        const nuevaAsistencia = new Attendance({
            student: estudiante._id,
            studentCard: idCard,
            checkIn: ahora,
            dateStr: fechaHoy
        });

        await nuevaAsistencia.save();

        console.log(`ASISTENCIA REGISTRADA: ${estudiante.studentName} (${estudiante.grade})`);
        
        return res.status(201).json({ 
            success: true, 
            message: `Bienvenido, ${estudiante.studentName}`,
            time: ahora.toLocaleTimeString()
        });

    } catch (error) {
        console.error("Error en el registro de asistencia:", error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};

export const getDailyAttendance = async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        const asistencias = await Attendance.find({ dateStr: hoy })
            .populate('student', 'studentName studentSurname grade') 
            .sort({ checkIn: -1 }); 

        return res.status(200).json({
            success: true,
            count: asistencias.length,
            data: asistencias
        });
    } catch (error) {
        console.error("Error al obtener asistencias:", error);
        return res.status(500).json({ success: false, message: "Error al obtener datos" });
    }
};
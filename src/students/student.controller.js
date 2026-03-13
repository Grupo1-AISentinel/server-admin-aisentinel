import Student from './student.model.js';

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

        const io = req.app.get('socketio');

        const photosBinary = req.files.map(file => ({
            buffer: file.buffer, 
            mimetype: file.mimetype
        }));

        io.emit('enviar_a_python', {
            nombre: `${req.body.studentName} ${req.body.studentSurname}`,
            carnet: req.body.idCard,
            fotos: photosBinary 
        });

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
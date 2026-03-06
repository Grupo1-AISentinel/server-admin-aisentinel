import { Router } from 'express';
import { createStudent, 
    getStudents,
    getStudentById,
    updateStudent,
    activateStudent,
    deactivateStudent,
    deleteStudent,
    getStudentByIdCard,
    updateStudentByIdCard,
    activateStudentByIdCard,
    deactivateStudentByIdCard,
    deleteStudentByIdCard
} from './student.controller.js';
import {  uploadStudentImage } from '../../middlewares/file-uploader.js';
import { cleanUploaderFileOnFinish, deleteFileOnError } from '../../middlewares/delete-file-on-error.js';
import { validateCreateStudent, validateDeleteStudent, validateStudentStatusChange, validateGetStudentById, validateGetStudents, validateUpdateStudent, validateByIdCard, validateUpdateByIdCard } from '../../middlewares/student-validators.js';


const router = Router();

router.post(
    '/create',
     uploadStudentImage.array('photo', 10),
    cleanUploaderFileOnFinish,
    validateCreateStudent,
    createStudent
); 

router.get(
    '/get',
    ...validateGetStudents,
    getStudents
)

router.get('/:id', ...validateGetStudentById, getStudentById);
// Rutas PUT - Requieren autenticación
router.put(
    '/:id',
    cleanUploaderFileOnFinish,
    validateUpdateStudent,
    updateStudent
);
router.put('/:id/activate', validateStudentStatusChange, activateStudent);
router.put('/:id/deactivate', validateStudentStatusChange, deactivateStudent);
router.delete('/:id', ...validateDeleteStudent, deleteStudent);

// Rutas por carnet (idCard)
router.get('/idcard/:idCard', ...validateByIdCard, getStudentByIdCard);
router.put('/idcard/:idCard', uploadStudentImage.array('photo', 3), cleanUploaderFileOnFinish, ...validateUpdateByIdCard, updateStudentByIdCard);
router.put('/idcard/:idCard/activate', ...validateByIdCard, activateStudentByIdCard);
router.put('/idcard/:idCard/deactivate', ...validateByIdCard, deactivateStudentByIdCard);
router.delete('/idcard/:idCard', ...validateByIdCard, deleteStudentByIdCard);

router.use(deleteFileOnError);

export default router;
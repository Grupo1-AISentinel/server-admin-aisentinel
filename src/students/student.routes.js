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
import { validateJWT } from '../../middlewares/validate-JWT.js';
import { validateAdmin, validateAdminOrCoordinator, validateCoordinatorGrade, validateStudentGradeById, validateStudentGradeByIdCard } from '../../middlewares/validate-role.js';


const router = Router();

router.use(validateJWT);

router.post(
    '/create',
    validateAdminOrCoordinator,
    validateCoordinatorGrade,
    uploadStudentImage.array('photo', 10),
    cleanUploaderFileOnFinish,
    validateCreateStudent,
    createStudent
);

router.get(
    '/get',
    validateAdminOrCoordinator,
    ...validateGetStudents,
    getStudents
);

router.get('/idcard/:idCard', validateAdminOrCoordinator, ...validateByIdCard, getStudentByIdCard);
router.put('/idcard/:idCard', validateAdminOrCoordinator, validateCoordinatorGrade, validateStudentGradeByIdCard, uploadStudentImage.array('photo', 3), cleanUploaderFileOnFinish, ...validateUpdateByIdCard, updateStudentByIdCard);
router.put('/idcard/:idCard/activate', validateAdminOrCoordinator, validateCoordinatorGrade, validateStudentGradeByIdCard, ...validateByIdCard, activateStudentByIdCard);
router.put('/idcard/:idCard/deactivate', validateAdminOrCoordinator, validateCoordinatorGrade, validateStudentGradeByIdCard, ...validateByIdCard, deactivateStudentByIdCard);
router.delete('/idcard/:idCard', validateAdmin, ...validateByIdCard, deleteStudentByIdCard);

router.get('/:id', validateAdminOrCoordinator, ...validateGetStudentById, getStudentById);
router.put('/:id', validateAdminOrCoordinator, validateCoordinatorGrade, validateStudentGradeById, uploadStudentImage.array('photo', 10), cleanUploaderFileOnFinish, validateUpdateStudent, updateStudent);
router.put('/:id/activate', validateAdminOrCoordinator, validateCoordinatorGrade, validateStudentGradeById, validateStudentStatusChange, activateStudent);
router.put('/:id/deactivate', validateAdminOrCoordinator, validateCoordinatorGrade, validateStudentGradeById, validateStudentStatusChange, deactivateStudent);
router.delete('/:id', validateAdmin, ...validateDeleteStudent, deleteStudent);

router.use(deleteFileOnError);

export default router;
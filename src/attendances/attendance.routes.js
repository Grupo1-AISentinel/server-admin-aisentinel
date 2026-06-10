import { Router } from 'express';
import { processAutomaticAttendance, getDailyAttendance } from '../attendances/attendance.controller.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';

const attendanceRouter = Router();


attendanceRouter.post('/automatic-detection', processAutomaticAttendance);


attendanceRouter.get('/daily-list', validateJWT, getDailyAttendance);

export default attendanceRouter;
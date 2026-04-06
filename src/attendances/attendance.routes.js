import { Router } from 'express';
import { processAutomaticAttendance, getDailyAttendance } from '../attendances/attendance.controller.js';

const attendanceRouter = Router();


attendanceRouter.post('/automatic-detection', processAutomaticAttendance);


attendanceRouter.get('/daily-list', getDailyAttendance);

export default attendanceRouter;
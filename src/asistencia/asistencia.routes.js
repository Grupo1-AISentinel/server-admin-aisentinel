import { Router } from 'express';
import { processAutomaticAttendance, getDailyAttendance } from '../asistencia/asistencia.controller.js';

const router = Router();


router.post('/automatic-detection', processAutomaticAttendance);


router.get('/daily-list', getDailyAttendance);

export default router;
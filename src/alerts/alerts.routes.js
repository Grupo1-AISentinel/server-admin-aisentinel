import { Router } from 'express';
import { processAutomaticDetection } from './alerts.controller.js';

const router = Router();

router.post('/automatic-detection', processAutomaticDetection);


export default router;
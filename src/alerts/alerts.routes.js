import { Router } from 'express';
import { processAutomaticDetection } from './alerts.controller.js';

const router = Router();

// Este es el único endpoint que necesitas para la automatización
router.post('/automatic-detection', processAutomaticDetection);


export default router;
import { Router } from 'express'
import { toggleInspection, getInspections } from './inspection.controller.js'
import { validateJWT } from '../../middlewares/validate-JWT.js'

const router = Router()

router.get('/', validateJWT, getInspections)
router.put('/toggle/:grade', validateJWT, toggleInspection)

export default router
import { Router } from 'express'
import { toggleInspection } from './inspection.controller.js'
import { validateJWT } from '../../middlewares/validate-JWT.js'

const router = Router()

router.put('/toggle/:grade', validateJWT, toggleInspection)

export default router
import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { photoHandler } from '../controllers/maintenance.controller';

const router = express.Router();

router.get('/:id/photo', authenticate, photoHandler);

export default router;

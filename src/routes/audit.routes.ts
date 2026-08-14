import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listHandler } from '../controllers/audit.controller';

const router = express.Router();

router.get('/', authenticate, authorize('admin'), listHandler);

export default router;

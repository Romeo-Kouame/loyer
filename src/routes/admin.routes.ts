import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getUserDetailHandler, listUsersHandler, overviewHandler } from '../controllers/admin.controller';

const router = express.Router();

router.use(authenticate, authorize('admin'));
router.get('/overview', overviewHandler);
router.get('/users', listUsersHandler);
router.get('/users/:id', getUserDetailHandler);

export default router;

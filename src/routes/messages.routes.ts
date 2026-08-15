import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listConversationsHandler, unreadCountHandler } from '../controllers/message.controller';

const router = express.Router();

router.use(authenticate, authorize('landlord', 'tenant'));
router.get('/', listConversationsHandler);
router.get('/unread-count', unreadCountHandler);

export default router;

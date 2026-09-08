import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  landlordDashboardHandler,
  landlordRecentPaymentsHandler,
  landlordRevenueHistoryHandler,
} from '../controllers/dashboard.controller';
import {
  listForLandlordHandler,
  pendingCountHandler,
  updateSeverityHandler,
  updateStatusHandler,
} from '../controllers/maintenance.controller';
import {
  listHandler as listNotificationsHandler,
  markAllReadHandler,
  markReadHandler,
  unreadCountHandler,
} from '../controllers/notifications.controller';

const router = express.Router();

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').required(),
});

const updateSeveritySchema = Joi.object({
  severity: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
});

router.use(authenticate, authorize('landlord'));
router.get('/dashboard', landlordDashboardHandler);
router.get('/dashboard/revenue-history', landlordRevenueHistoryHandler);
router.get('/dashboard/recent-payments', landlordRecentPaymentsHandler);
router.get('/maintenance', listForLandlordHandler);
router.get('/maintenance/pending-count', pendingCountHandler);
router.patch('/maintenance/:id', validate(updateStatusSchema), updateStatusHandler);
router.patch('/maintenance/:id/severity', validate(updateSeveritySchema), updateSeverityHandler);
router.get('/notifications', listNotificationsHandler);
router.get('/notifications/unread-count', unreadCountHandler);
router.patch('/notifications/:id/read', markReadHandler);
router.post('/notifications/read-all', markAllReadHandler);

export default router;

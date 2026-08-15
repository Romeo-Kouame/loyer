import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  landlordDashboardHandler,
  landlordRecentPaymentsHandler,
  landlordRevenueHistoryHandler,
} from '../controllers/dashboard.controller';
import { listForLandlordHandler, updateStatusHandler } from '../controllers/maintenance.controller';

const router = express.Router();

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').required(),
});

router.use(authenticate, authorize('landlord'));
router.get('/dashboard', landlordDashboardHandler);
router.get('/dashboard/revenue-history', landlordRevenueHistoryHandler);
router.get('/dashboard/recent-payments', landlordRecentPaymentsHandler);
router.get('/maintenance', listForLandlordHandler);
router.patch('/maintenance/:id', validate(updateStatusSchema), updateStatusHandler);

export default router;

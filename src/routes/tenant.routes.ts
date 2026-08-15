import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { historyHandler, meHandler, notificationsHandler, scoreHandler } from '../controllers/tenant.controller';
import { listMineHandler, reportHandler } from '../controllers/maintenance.controller';
import { uploadMaintenancePhoto } from '../middleware/upload';

const router = express.Router();

const reportIssueSchema = Joi.object({
  propertyId: Joi.string().uuid().required(),
  issueType: Joi.string().min(2).max(100).required(),
  description: Joi.string().min(5).max(1000).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
});

router.use(authenticate, authorize('tenant'));
router.get('/me', meHandler);
router.get('/history', historyHandler);
router.get('/notifications', notificationsHandler);
router.get('/score', scoreHandler);
router.post('/maintenance', uploadMaintenancePhoto, validate(reportIssueSchema), reportHandler);
router.get('/maintenance', listMineHandler);

export default router;

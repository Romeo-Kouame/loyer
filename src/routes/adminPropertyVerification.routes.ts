import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { adminListVerificationsHandler, adminReviewVerificationHandler } from '../controllers/properties.controller';

const router = express.Router();

const reviewSchema = Joi.object({
  status: Joi.string().valid('verified', 'rejected').required(),
  rejectionReason: Joi.string().max(500).when('status', { is: 'rejected', then: Joi.required() }),
});

router.use(authenticate, authorize('admin'));
router.get('/', adminListVerificationsHandler);
router.patch('/:propertyId', validate(reviewSchema), adminReviewVerificationHandler);

export default router;

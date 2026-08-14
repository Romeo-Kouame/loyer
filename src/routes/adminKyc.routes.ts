import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { adminListHandler, adminReviewHandler } from '../controllers/kyc.controller';

const router = express.Router();

const reviewSchema = Joi.object({
  status: Joi.string().valid('verified', 'rejected').required(),
  rejectionReason: Joi.string().max(500).when('status', { is: 'rejected', then: Joi.required() }),
});

router.use(authenticate, authorize('admin'));
router.get('/', adminListHandler);
router.patch('/:userId', validate(reviewSchema), adminReviewHandler);

export default router;

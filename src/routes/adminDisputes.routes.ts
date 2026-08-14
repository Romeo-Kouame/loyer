import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { adminListHandler, adminResolveHandler } from '../controllers/dispute.controller';

const router = express.Router();

const resolveSchema = Joi.object({
  resolution: Joi.string().valid('confirmed', 'refunded').required(),
  notes: Joi.string().max(500).optional(),
});

router.use(authenticate, authorize('admin'));
router.get('/', adminListHandler);
router.patch('/:paymentId', validate(resolveSchema), adminResolveHandler);

export default router;

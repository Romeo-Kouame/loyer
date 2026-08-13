import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { initiateHandler, statusHandler, webhookHandler } from '../controllers/payments.controller';

const router = express.Router();

const initiateSchema = Joi.object({
  propertyId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  returnUrl: Joi.string().uri().required(),
  cancelUrl: Joi.string().uri().optional(),
  description: Joi.string().max(255).optional(),
});

router.post('/webhook', webhookHandler);
router.post('/initiate', authenticate, authorize('tenant'), validate(initiateSchema), initiateHandler);
router.get('/:id', authenticate, statusHandler);

export default router;

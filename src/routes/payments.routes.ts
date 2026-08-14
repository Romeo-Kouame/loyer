import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { initiateHandler, receiptHandler, statusHandler, webhookHandler } from '../controllers/payments.controller';
import { openHandler as openDisputeHandler } from '../controllers/dispute.controller';

const router = express.Router();

const initiateSchema = Joi.object({
  propertyId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  returnUrl: Joi.string().uri().required(),
  cancelUrl: Joi.string().uri().optional(),
  description: Joi.string().max(255).optional(),
});

const disputeSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required(),
});

router.post('/webhook', webhookHandler);
router.post('/initiate', authenticate, authorize('tenant'), validate(initiateSchema), initiateHandler);
router.get('/:id', authenticate, statusHandler);
router.get('/:id/receipt', authenticate, receiptHandler);
router.post('/:id/dispute', authenticate, validate(disputeSchema), openDisputeHandler);

export default router;

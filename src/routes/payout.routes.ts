import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { listMyPayoutsHandler, retryPayoutHandler, setDestinationHandler } from '../controllers/payout.controller';

const router = express.Router();

const destinationSchema = Joi.object({
  payoutProvider: Joi.string().valid('mtn', 'orange').required(),
  payoutPhoneNumber: Joi.string()
    .pattern(/^\+?\d{8,15}$/)
    .required(),
});

router.use(authenticate);
router.patch('/destination', authorize('landlord'), validate(destinationSchema), setDestinationHandler);
router.get('/', authorize('landlord'), listMyPayoutsHandler);
router.post('/:id/retry', retryPayoutHandler);

export default router;

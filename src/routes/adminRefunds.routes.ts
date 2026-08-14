import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { adminCompleteHandler, adminListHandler } from '../controllers/refund.controller';

const router = express.Router();

const completeSchema = Joi.object({
  adminNotes: Joi.string().max(500).optional(),
});

router.use(authenticate, authorize('admin'));
router.get('/', adminListHandler);
router.post('/:id/complete', validate(completeSchema), adminCompleteHandler);

export default router;

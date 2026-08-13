import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createHandler, getHandler, listHandler } from '../controllers/properties.controller';

const router = express.Router();

const createPropertySchema = Joi.object({
  address: Joi.string().min(5).max(500).required(),
  numberOfApartments: Joi.number().integer().positive().required(),
});

router.use(authenticate);
router.post('/', authorize('landlord'), validate(createPropertySchema), createHandler);
router.get('/', authorize('landlord'), listHandler);
router.get('/:id', getHandler);

export default router;

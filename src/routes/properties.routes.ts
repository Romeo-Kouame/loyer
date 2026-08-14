import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createHandler, getHandler, listHandler } from '../controllers/properties.controller';
import { assignTenantHandler, endLeaseHandler, getLeaseBalanceHandler } from '../controllers/leases.controller';

const router = express.Router();

const createPropertySchema = Joi.object({
  address: Joi.string().min(5).max(500).required(),
  numberOfApartments: Joi.number().integer().positive().required(),
});

const assignTenantSchema = Joi.object({
  tenantEmail: Joi.string().email().required(),
  rentAmount: Joi.number().positive().required(),
  moveInDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  installmentsAllowed: Joi.boolean().optional(),
});

router.use(authenticate);
router.post('/', authorize('landlord'), validate(createPropertySchema), createHandler);
router.get('/', listHandler);
router.get('/:id', getHandler);
router.post('/:id/leases', authorize('landlord'), validate(assignTenantSchema), assignTenantHandler);
router.delete('/:id/leases/:leaseId', authorize('landlord'), endLeaseHandler);
router.get('/:id/leases/:leaseId/balance', getLeaseBalanceHandler);

export default router;

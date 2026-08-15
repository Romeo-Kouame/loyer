import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createHandler,
  getHandler,
  listHandler,
  submitVerificationHandler,
  verificationDocumentHandler,
} from '../controllers/properties.controller';
import {
  assignTenantHandler,
  endLeaseHandler,
  getArrearsHandler,
  getLeaseBalanceHandler,
  getMessagesHandler,
  getTenantScoreHandler,
  getTenantsHandler,
  sendMessageHandler,
} from '../controllers/leases.controller';
import { uploadPropertyVerificationDocument } from '../middleware/upload';

const router = express.Router();

const createPropertySchema = Joi.object({
  address: Joi.string().min(5).max(500).required(),
  numberOfApartments: Joi.number().integer().positive().required(),
});

const assignTenantSchema = Joi.object({
  tenantEmail: Joi.string().email().optional(),
  tenantPhone: Joi.string().min(8).max(20).optional(),
  unitLabel: Joi.string().min(1).max(50).required(),
  rentAmount: Joi.number().positive().required(),
  moveInDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  installmentsAllowed: Joi.boolean().optional(),
}).or('tenantEmail', 'tenantPhone');

const sendMessageSchema = Joi.object({
  body: Joi.string().min(1).max(2000).required(),
});

router.use(authenticate);
router.post('/', authorize('landlord'), validate(createPropertySchema), createHandler);
router.get('/', listHandler);
router.get('/:id', getHandler);
router.post('/:id/leases', authorize('landlord'), validate(assignTenantSchema), assignTenantHandler);
router.delete('/:id/leases/:leaseId', authorize('landlord'), endLeaseHandler);
router.get('/:id/leases/:leaseId/balance', getLeaseBalanceHandler);
router.get('/:id/arrears', authorize('landlord'), getArrearsHandler);
router.get('/:id/tenants', authorize('landlord'), getTenantsHandler);
router.get('/:id/leases/:leaseId/score', authorize('landlord'), getTenantScoreHandler);
router.get('/:id/leases/:leaseId/messages', getMessagesHandler);
router.post('/:id/leases/:leaseId/messages', validate(sendMessageSchema), sendMessageHandler);
router.post('/:id/verification', authorize('landlord'), uploadPropertyVerificationDocument, submitVerificationHandler);
router.get('/:id/verification/document', verificationDocumentHandler);

export default router;

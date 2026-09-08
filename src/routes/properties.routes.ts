import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  addPhotoHandler,
  coverPhotoHandler,
  createHandler,
  deletePhotoHandler,
  getHandler,
  listHandler,
  listPhotosHandler,
  photoFileHandler,
  submitVerificationHandler,
  updateHandler,
  verificationDocumentHandler,
} from '../controllers/properties.controller';
import {
  assignTenantHandler,
  endLeaseHandler,
  getArrearsHandler,
  getLeaseAgreementHandler,
  getLeaseBalanceHandler,
  getMessagesHandler,
  getTenantScoreHandler,
  getTenantsHandler,
  sendMessageHandler,
  signLeaseAgreementHandler,
} from '../controllers/leases.controller';
import { uploadPropertyPhoto, uploadPropertyVerificationDocument } from '../middleware/upload';

const router = express.Router();

const createPropertySchema = Joi.object({
  address: Joi.string().min(5).max(500).required(),
  numberOfApartments: Joi.number().integer().positive().required(),
  propertyType: Joi.string().max(100).optional(),
  surfaceArea: Joi.number().positive().optional(),
  bedroomCount: Joi.number().integer().min(0).optional(),
  bathroomCount: Joi.number().integer().min(0).optional(),
  monthlyRent: Joi.number().min(0).optional(),
});

const updatePropertySchema = Joi.object({
  address: Joi.string().min(5).max(500).optional(),
  numberOfApartments: Joi.number().integer().positive().optional(),
  propertyType: Joi.string().max(100).optional(),
  surfaceArea: Joi.number().positive().optional(),
  bedroomCount: Joi.number().integer().min(0).optional(),
  bathroomCount: Joi.number().integer().min(0).optional(),
  monthlyRent: Joi.number().min(0).optional(),
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
  depositAmount: Joi.number().min(0).optional(),
  advanceRentAmount: Joi.number().min(0).optional(),
}).or('tenantEmail', 'tenantPhone');

const sendMessageSchema = Joi.object({
  body: Joi.string().min(1).max(2000).required(),
});

const signAgreementSchema = Joi.object({
  fullName: Joi.string().min(2).max(255).required(),
});

router.use(authenticate);
router.post('/', authorize('landlord'), validate(createPropertySchema), createHandler);
router.get('/', listHandler);
router.get('/:id', getHandler);
router.patch('/:id', authorize('landlord'), validate(updatePropertySchema), updateHandler);
router.post('/:id/leases', authorize('landlord'), validate(assignTenantSchema), assignTenantHandler);
router.delete('/:id/leases/:leaseId', authorize('landlord'), endLeaseHandler);
router.get('/:id/leases/:leaseId/balance', getLeaseBalanceHandler);
router.get('/:id/arrears', authorize('landlord'), getArrearsHandler);
router.get('/:id/tenants', authorize('landlord'), getTenantsHandler);
router.get('/:id/leases/:leaseId/score', authorize('landlord'), getTenantScoreHandler);
router.get('/:id/leases/:leaseId/messages', getMessagesHandler);
router.post('/:id/leases/:leaseId/messages', validate(sendMessageSchema), sendMessageHandler);
router.get('/:id/leases/:leaseId/agreement', getLeaseAgreementHandler);
router.post('/:id/leases/:leaseId/agreement/sign', validate(signAgreementSchema), signLeaseAgreementHandler);
router.post('/:id/verification', authorize('landlord'), uploadPropertyVerificationDocument, submitVerificationHandler);
router.get('/:id/verification/document', verificationDocumentHandler);
router.post('/:id/photos', authorize('landlord'), uploadPropertyPhoto, addPhotoHandler);
router.get('/:id/photos', listPhotosHandler);
router.get('/:id/photos/cover', coverPhotoHandler);
router.get('/:id/photos/:photoId', photoFileHandler);
router.delete('/:id/photos/:photoId', authorize('landlord'), deletePhotoHandler);

export default router;

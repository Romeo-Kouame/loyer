import express from 'express';
import Joi from 'joi';
import {
  changePasswordHandler,
  loginHandler,
  meHandler,
  profilePictureHandler,
  refreshHandler,
  registerHandler,
  updateProfileHandler,
  updateProfilePictureHandler,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { uploadProfilePicture } from '../middleware/upload';

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().min(8).max(20).required(),
  name: Joi.string().min(2).max(255).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('landlord', 'tenant').required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  phone: Joi.string().min(8).max(20).optional(),
  emailRemindersEnabled: Joi.boolean().optional(),
  firstName: Joi.string().min(1).max(100).optional(),
  lastName: Joi.string().min(1).max(100).optional(),
  dateOfBirth: Joi.date().iso().max('now').optional(),
  placeOfBirth: Joi.string().min(1).max(150).optional(),
  nationality: Joi.string().min(1).max(100).optional(),
  idDocumentType: Joi.string().valid('cni', 'passport').optional(),
  idDocumentNumber: Joi.string().min(1).max(50).optional(),
  activitySector: Joi.string().min(1).max(150).optional(),
  profession: Joi.string().min(1).max(150).optional(),
  secondPhone: Joi.string().min(8).max(30).optional(),
  currentAddress: Joi.string().min(1).max(255).optional(),
  emergencyContactName: Joi.string().min(1).max(150).optional(),
  emergencyContactPhone: Joi.string().min(8).max(30).optional(),
});

router.post('/register', validate(registerSchema), registerHandler);
router.post('/login', validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.get('/me', authenticate, meHandler);
router.patch('/password', authenticate, validate(changePasswordSchema), changePasswordHandler);
router.patch('/profile', authenticate, validate(updateProfileSchema), updateProfileHandler);
router.post('/profile-picture', authenticate, uploadProfilePicture, updateProfilePictureHandler);
router.get('/profile-picture/:userId', authenticate, profilePictureHandler);

export default router;

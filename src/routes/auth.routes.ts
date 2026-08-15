import express from 'express';
import Joi from 'joi';
import {
  changePasswordHandler,
  loginHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  updateProfileHandler,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';

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
  phone: Joi.string().min(8).max(20).optional(),
  emailRemindersEnabled: Joi.boolean().optional(),
});

router.post('/register', validate(registerSchema), registerHandler);
router.post('/login', validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.get('/me', authenticate, meHandler);
router.patch('/password', authenticate, validate(changePasswordSchema), changePasswordHandler);
router.patch('/profile', authenticate, validate(updateProfileSchema), updateProfileHandler);

export default router;

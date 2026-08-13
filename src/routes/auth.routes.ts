import express from 'express';
import Joi from 'joi';
import { loginHandler, refreshHandler, registerHandler } from '../controllers/auth.controller';
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

router.post('/register', validate(registerSchema), registerHandler);
router.post('/login', validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);

export default router;

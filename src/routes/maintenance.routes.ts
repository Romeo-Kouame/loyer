import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { addCommentHandler, listCommentsHandler, photoHandler } from '../controllers/maintenance.controller';

const router = express.Router();

const addCommentSchema = Joi.object({
  body: Joi.string().min(1).max(1000).required(),
});

router.get('/:id/photo', authenticate, photoHandler);
router.get('/:id/comments', authenticate, listCommentsHandler);
router.post('/:id/comments', authenticate, validate(addCommentSchema), addCommentHandler);

export default router;

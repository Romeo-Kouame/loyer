import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { uploadKycDocument } from '../middleware/upload';
import { documentHandler, submitHandler } from '../controllers/kyc.controller';

const router = express.Router();

router.use(authenticate);
router.post('/', uploadKycDocument, submitHandler);
router.get('/document/:userId', documentHandler);

export default router;

import express from 'express';
import { getPublicPassportHandler } from '../controllers/passport.controller';

// Public, unauthenticated by design: this is what a prospective landlord
// (who may not even have an account) opens from a link the tenant shared.
// The token itself (192 bits of randomness) is the only access control.
const router = express.Router();

router.get('/:token', getPublicPassportHandler);

export default router;

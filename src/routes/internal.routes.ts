import express from 'express';
import { requireCronSecret } from '../middleware/cronAuth';
import { payoutsSweepHandler, remindersSweepHandler } from '../controllers/internal.controller';

const router = express.Router();

router.use(requireCronSecret);
router.get('/cron/payouts', payoutsSweepHandler);
router.get('/cron/reminders', remindersSweepHandler);

export default router;

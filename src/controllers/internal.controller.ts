import express from 'express';
import { processDuePayouts } from '../services/payout.service';
import { sendDueReminders } from '../services/reminder.service';

export async function payoutsSweepHandler(_req: express.Request, res: express.Response): Promise<void> {
  const result = await processDuePayouts();
  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

export async function remindersSweepHandler(_req: express.Request, res: express.Response): Promise<void> {
  const result = await sendDueReminders();
  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

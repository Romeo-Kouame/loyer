import express from 'express';
import { getLandlordDashboard } from '../services/dashboard.service';

export async function landlordDashboardHandler(req: express.Request, res: express.Response): Promise<void> {
  const dashboard = await getLandlordDashboard(req.user!.userId);
  res.status(200).json({ success: true, data: dashboard, timestamp: new Date() });
}

import express from 'express';
import { getLandlordDashboard, getRecentPayments, getRevenueHistory } from '../services/dashboard.service';

export async function landlordDashboardHandler(req: express.Request, res: express.Response): Promise<void> {
  const dashboard = await getLandlordDashboard(req.user!.userId);
  res.status(200).json({ success: true, data: dashboard, timestamp: new Date() });
}

export async function landlordRevenueHistoryHandler(req: express.Request, res: express.Response): Promise<void> {
  const history = await getRevenueHistory(req.user!.userId);
  res.status(200).json({ success: true, data: history, timestamp: new Date() });
}

export async function landlordRecentPaymentsHandler(req: express.Request, res: express.Response): Promise<void> {
  const payments = await getRecentPayments(req.user!.userId);
  res.status(200).json({ success: true, data: payments, timestamp: new Date() });
}

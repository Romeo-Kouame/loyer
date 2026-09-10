import express from 'express';
import { getLandlordDashboard, getRecentPayments, getRevenueHistory } from '../services/dashboard.service';
import { getLandlordArrears } from '../services/lease.service';

const ALLOWED_REVENUE_HISTORY_MONTHS = [3, 6, 12];

export async function landlordDashboardHandler(req: express.Request, res: express.Response): Promise<void> {
  const dashboard = await getLandlordDashboard(req.user!.userId);
  res.status(200).json({ success: true, data: dashboard, timestamp: new Date() });
}

export async function landlordRevenueHistoryHandler(req: express.Request, res: express.Response): Promise<void> {
  const requestedMonths = Number(req.query.months);
  const months = ALLOWED_REVENUE_HISTORY_MONTHS.includes(requestedMonths) ? requestedMonths : 6;
  const history = await getRevenueHistory(req.user!.userId, months);
  res.status(200).json({ success: true, data: history, timestamp: new Date() });
}

export async function landlordRecentPaymentsHandler(req: express.Request, res: express.Response): Promise<void> {
  const payments = await getRecentPayments(req.user!.userId);
  res.status(200).json({ success: true, data: payments, timestamp: new Date() });
}

export async function landlordArrearsHandler(req: express.Request, res: express.Response): Promise<void> {
  const arrears = await getLandlordArrears(req.user!.userId);
  res.status(200).json({ success: true, data: arrears, timestamp: new Date() });
}

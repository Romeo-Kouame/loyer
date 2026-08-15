import express from 'express';
import * as tenantService from '../services/tenant.service';

export async function meHandler(req: express.Request, res: express.Response): Promise<void> {
  const overview = await tenantService.getMyOverview(req.user!.userId);
  res.status(200).json({ success: true, data: overview, timestamp: new Date() });
}

export async function historyHandler(req: express.Request, res: express.Response): Promise<void> {
  const history = await tenantService.getMyPaymentHistory(req.user!.userId, {
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  });
  res.status(200).json({ success: true, data: history, timestamp: new Date() });
}

export async function notificationsHandler(req: express.Request, res: express.Response): Promise<void> {
  const notifications = await tenantService.getMyNotifications(req.user!.userId);
  res.status(200).json({ success: true, data: notifications, timestamp: new Date() });
}

export async function scoreHandler(req: express.Request, res: express.Response): Promise<void> {
  const score = await tenantService.getMyScore(req.user!.userId);
  res.status(200).json({ success: true, data: score, timestamp: new Date() });
}

import express from 'express';
import * as adminService from '../services/admin.service';

export async function overviewHandler(req: express.Request, res: express.Response): Promise<void> {
  const overview = await adminService.getOverview();
  res.status(200).json({ success: true, data: overview, timestamp: new Date() });
}

export async function listUsersHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await adminService.listUsers({
    role: typeof req.query.role === 'string' ? req.query.role : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

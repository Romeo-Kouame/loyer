import express from 'express';
import * as auditService from '../services/audit.service';

export async function listHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await auditService.listAuditLogs({
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
    action: typeof req.query.action === 'string' ? req.query.action : undefined,
  });

  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

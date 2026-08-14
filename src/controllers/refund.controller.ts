import express from 'express';
import * as refundService from '../services/refund.service';
import { RefundStatus } from '../repositories/refund.repository';

export async function adminListHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await refundService.listRefunds({
    status: req.query.status as RefundStatus | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  });

  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

export async function adminCompleteHandler(req: express.Request, res: express.Response): Promise<void> {
  const refund = await refundService.completeRefund(
    { refundId: req.params.id, adminId: req.user!.userId, adminNotes: req.body.adminNotes },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(200).json({ success: true, data: refund, timestamp: new Date() });
}

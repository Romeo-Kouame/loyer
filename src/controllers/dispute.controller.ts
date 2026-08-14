import express from 'express';
import * as disputeService from '../services/dispute.service';

function contextFrom(req: express.Request) {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}

export async function openHandler(req: express.Request, res: express.Response): Promise<void> {
  const payment = await disputeService.openDispute(
    {
      paymentId: req.params.id,
      userId: req.user!.userId,
      role: req.user!.role,
      reason: req.body.reason,
    },
    contextFrom(req)
  );

  res.status(200).json({ success: true, data: payment, timestamp: new Date() });
}

export async function adminListHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await disputeService.listDisputes({
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  });

  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

export async function adminResolveHandler(req: express.Request, res: express.Response): Promise<void> {
  const payment = await disputeService.resolveDispute(
    {
      paymentId: req.params.paymentId,
      adminId: req.user!.userId,
      resolution: req.body.resolution,
      notes: req.body.notes,
    },
    contextFrom(req)
  );

  res.status(200).json({ success: true, data: payment, timestamp: new Date() });
}

import express from 'express';
import * as payoutService from '../services/payout.service';

function contextFrom(req: express.Request) {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}

export async function setDestinationHandler(req: express.Request, res: express.Response): Promise<void> {
  const user = await payoutService.setPayoutDestination(
    {
      userId: req.user!.userId,
      payoutProvider: req.body.payoutProvider,
      payoutPhoneNumber: req.body.payoutPhoneNumber,
    },
    contextFrom(req)
  );

  res.status(200).json({
    success: true,
    data: { payoutProvider: user.payoutProvider, payoutPhoneNumber: user.payoutPhoneNumber },
    timestamp: new Date(),
  });
}

export async function listMyPayoutsHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await payoutService.listMyPayouts({
    landlordId: req.user!.userId,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  });

  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

export async function retryPayoutHandler(req: express.Request, res: express.Response): Promise<void> {
  const payout = await payoutService.retryPayout(
    { payoutId: req.params.id, requesterId: req.user!.userId, requesterRole: req.user!.role },
    contextFrom(req)
  );

  res.status(200).json({ success: true, data: payout, timestamp: new Date() });
}

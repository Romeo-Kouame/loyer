import express from 'express';
import * as paymentService from '../services/payment.service';

export async function initiateHandler(req: express.Request, res: express.Response): Promise<void> {
  const payment = await paymentService.initiatePayment(
    {
      tenantId: req.user!.userId,
      propertyId: req.body.propertyId,
      amount: req.body.amount,
      returnUrl: req.body.returnUrl,
      cancelUrl: req.body.cancelUrl,
      description: req.body.description,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(201).json({ success: true, data: payment, timestamp: new Date() });
}

export async function statusHandler(req: express.Request, res: express.Response): Promise<void> {
  const payment = await paymentService.getPaymentStatus({
    paymentId: req.params.id,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  res.status(200).json({ success: true, data: payment, timestamp: new Date() });
}

export async function receiptHandler(req: express.Request, res: express.Response): Promise<void> {
  const receipt = await paymentService.getReceipt({
    paymentId: req.params.id,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  res.status(200).json({ success: true, data: receipt, timestamp: new Date() });
}

export async function webhookHandler(req: express.Request, res: express.Response): Promise<void> {
  const signature = req.header('X-KPAY-Signature');
  await paymentService.handleWebhook(req.body as Buffer, signature, {
    ipAddress: req.ip,
    userAgent: req.header('user-agent'),
  });
  res.status(200).json({ received: true });
}

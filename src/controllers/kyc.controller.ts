import express from 'express';
import * as kycService from '../services/kyc.service';
import { ValidationError } from '../utils/errors';
import { KycStatus } from '../repositories/user.repository';

export async function submitHandler(req: express.Request, res: express.Response): Promise<void> {
  if (!req.file) {
    throw new ValidationError('A document file is required');
  }

  const user = await kycService.submitKyc(
    { userId: req.user!.userId, documentPath: req.file.path, documentMimeType: req.file.mimetype },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(200).json({
    success: true,
    data: { kycStatus: user.kycStatus, kycSubmittedAt: user.kycSubmittedAt },
    timestamp: new Date(),
  });
}

export async function documentHandler(req: express.Request, res: express.Response): Promise<void> {
  const { path, mimeType } = await kycService.getKycDocumentPath({
    userId: req.params.userId,
    requesterId: req.user!.userId,
    requesterRole: req.user!.role,
  });

  res.setHeader('Content-Type', mimeType);
  res.sendFile(path);
}

export async function adminListHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await kycService.listPendingKyc({
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    status: req.query.status as KycStatus | undefined,
  });

  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

export async function adminReviewHandler(req: express.Request, res: express.Response): Promise<void> {
  const user = await kycService.reviewKyc(
    {
      userId: req.params.userId,
      status: req.body.status,
      rejectionReason: req.body.rejectionReason,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(200).json({
    success: true,
    data: { kycStatus: user.kycStatus, kycReviewedAt: user.kycReviewedAt },
    timestamp: new Date(),
  });
}

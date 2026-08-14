import express from 'express';
import * as propertyService from '../services/property.service';
import { ValidationError } from '../utils/errors';
import { PropertyVerificationStatus } from '../repositories/property.repository';

export async function createHandler(req: express.Request, res: express.Response): Promise<void> {
  const property = await propertyService.addProperty(
    {
      ownerId: req.user!.userId,
      address: req.body.address,
      numberOfApartments: req.body.numberOfApartments,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(201).json({ success: true, data: property, timestamp: new Date() });
}

export async function listHandler(req: express.Request, res: express.Response): Promise<void> {
  const properties = await propertyService.listMyProperties({
    userId: req.user!.userId,
    role: req.user!.role,
  });
  res.status(200).json({ success: true, data: properties, timestamp: new Date() });
}

export async function getHandler(req: express.Request, res: express.Response): Promise<void> {
  const property = await propertyService.getProperty({
    propertyId: req.params.id,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  res.status(200).json({ success: true, data: property, timestamp: new Date() });
}

export async function submitVerificationHandler(req: express.Request, res: express.Response): Promise<void> {
  if (!req.file) {
    throw new ValidationError('A document file is required');
  }

  const property = await propertyService.submitVerification(
    {
      propertyId: req.params.id,
      ownerId: req.user!.userId,
      documentPath: req.file.path,
      documentMimeType: req.file.mimetype,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(200).json({
    success: true,
    data: { verificationStatus: property.verificationStatus, verificationSubmittedAt: property.verificationSubmittedAt },
    timestamp: new Date(),
  });
}

export async function verificationDocumentHandler(req: express.Request, res: express.Response): Promise<void> {
  const { path, mimeType } = await propertyService.getVerificationDocumentPath({
    propertyId: req.params.id,
    requesterId: req.user!.userId,
    requesterRole: req.user!.role,
  });

  res.setHeader('Content-Type', mimeType);
  res.sendFile(path);
}

export async function adminListVerificationsHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await propertyService.listPendingVerifications({
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    status: req.query.status as PropertyVerificationStatus | undefined,
  });

  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

export async function adminReviewVerificationHandler(req: express.Request, res: express.Response): Promise<void> {
  const property = await propertyService.reviewVerification(
    {
      propertyId: req.params.propertyId,
      status: req.body.status,
      rejectionReason: req.body.rejectionReason,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(200).json({
    success: true,
    data: { verificationStatus: property.verificationStatus, verificationReviewedAt: property.verificationReviewedAt },
    timestamp: new Date(),
  });
}

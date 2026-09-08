import express from 'express';
import * as propertyService from '../services/property.service';
import { ValidationError } from '../utils/errors';
import { PropertyVerificationStatus } from '../repositories/property.repository';
import { sendStoredFile } from '../utils/servedFile';

export async function createHandler(req: express.Request, res: express.Response): Promise<void> {
  const property = await propertyService.addProperty(
    {
      ownerId: req.user!.userId,
      address: req.body.address,
      numberOfApartments: req.body.numberOfApartments,
      propertyType: req.body.propertyType,
      surfaceArea: req.body.surfaceArea,
      bedroomCount: req.body.bedroomCount,
      bathroomCount: req.body.bathroomCount,
      monthlyRent: req.body.monthlyRent,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(201).json({ success: true, data: property, timestamp: new Date() });
}

export async function updateHandler(req: express.Request, res: express.Response): Promise<void> {
  const property = await propertyService.updateProperty(
    {
      propertyId: req.params.id,
      ownerId: req.user!.userId,
      address: req.body.address,
      numberOfApartments: req.body.numberOfApartments,
      propertyType: req.body.propertyType,
      surfaceArea: req.body.surfaceArea,
      bedroomCount: req.body.bedroomCount,
      bathroomCount: req.body.bathroomCount,
      monthlyRent: req.body.monthlyRent,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(200).json({ success: true, data: property, timestamp: new Date() });
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

export async function addPhotoHandler(req: express.Request, res: express.Response): Promise<void> {
  if (!req.file) {
    throw new ValidationError('A photo file is required');
  }

  const photo = await propertyService.addPropertyPhoto(
    {
      propertyId: req.params.id,
      ownerId: req.user!.userId,
      path: req.file.path,
      mimeType: req.file.mimetype,
    },
    { ipAddress: req.ip, userAgent: req.header('user-agent') }
  );

  res.status(201).json({
    success: true,
    data: { id: photo.id, position: photo.position, createdAt: photo.createdAt },
    timestamp: new Date(),
  });
}

export async function listPhotosHandler(req: express.Request, res: express.Response): Promise<void> {
  const photos = await propertyService.listPropertyPhotos({
    propertyId: req.params.id,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  res.status(200).json({
    success: true,
    data: photos.map((photo) => ({ id: photo.id, position: photo.position, createdAt: photo.createdAt })),
    timestamp: new Date(),
  });
}

export async function photoFileHandler(req: express.Request, res: express.Response): Promise<void> {
  const { path, mimeType } = await propertyService.getPropertyPhotoFile({
    propertyId: req.params.id,
    photoId: req.params.photoId,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  sendStoredFile(res, path, mimeType);
}

export async function coverPhotoHandler(req: express.Request, res: express.Response): Promise<void> {
  const photo = await propertyService.getCoverPhotoFile({
    propertyId: req.params.id,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  if (!photo) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No photo found' }, timestamp: new Date() });
    return;
  }

  sendStoredFile(res, photo.path, photo.mimeType);
}

export async function deletePhotoHandler(req: express.Request, res: express.Response): Promise<void> {
  await propertyService.deletePropertyPhoto({
    propertyId: req.params.id,
    photoId: req.params.photoId,
    ownerId: req.user!.userId,
  });

  res.status(204).send();
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

  sendStoredFile(res, path, mimeType);
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

import express from 'express';
import * as maintenanceService from '../services/maintenance.service';
import { sendStoredFile } from '../utils/servedFile';

function contextFrom(req: express.Request) {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}

export async function reportHandler(req: express.Request, res: express.Response): Promise<void> {
  const request = await maintenanceService.reportIssue(
    {
      tenantId: req.user!.userId,
      propertyId: req.body.propertyId,
      issueType: req.body.issueType,
      description: req.body.description,
      severity: req.body.severity,
      photoPath: req.file?.path ?? null,
      photoMimeType: req.file?.mimetype ?? null,
    },
    contextFrom(req)
  );

  res.status(201).json({ success: true, data: request, timestamp: new Date() });
}

export async function listMineHandler(req: express.Request, res: express.Response): Promise<void> {
  const requests = await maintenanceService.listMyRequests(req.user!.userId);
  res.status(200).json({ success: true, data: requests, timestamp: new Date() });
}

export async function listForLandlordHandler(req: express.Request, res: express.Response): Promise<void> {
  const requests = await maintenanceService.listRequestsForLandlord(req.user!.userId);
  res.status(200).json({ success: true, data: requests, timestamp: new Date() });
}

export async function updateStatusHandler(req: express.Request, res: express.Response): Promise<void> {
  const request = await maintenanceService.updateStatus(
    {
      requestId: req.params.id,
      landlordId: req.user!.userId,
      status: req.body.status,
    },
    contextFrom(req)
  );

  res.status(200).json({ success: true, data: request, timestamp: new Date() });
}

export async function photoHandler(req: express.Request, res: express.Response): Promise<void> {
  const { path, mimeType } = await maintenanceService.getPhotoPath({
    requestId: req.params.id,
    requesterId: req.user!.userId,
    requesterRole: req.user!.role,
  });

  sendStoredFile(res, path, mimeType);
}

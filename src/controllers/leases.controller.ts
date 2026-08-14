import express from 'express';
import * as leaseService from '../services/lease.service';

export async function assignTenantHandler(req: express.Request, res: express.Response): Promise<void> {
  const lease = await leaseService.assignTenant({
    landlordId: req.user!.userId,
    propertyId: req.params.id,
    tenantEmail: req.body.tenantEmail,
  });

  res.status(201).json({ success: true, data: lease, timestamp: new Date() });
}

export async function endLeaseHandler(req: express.Request, res: express.Response): Promise<void> {
  const lease = await leaseService.endLease({
    landlordId: req.user!.userId,
    propertyId: req.params.id,
    leaseId: req.params.leaseId,
  });

  res.status(200).json({ success: true, data: lease, timestamp: new Date() });
}

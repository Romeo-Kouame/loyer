import express from 'express';
import * as leaseService from '../services/lease.service';

function contextFrom(req: express.Request) {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}

export async function assignTenantHandler(req: express.Request, res: express.Response): Promise<void> {
  const lease = await leaseService.assignTenant(
    {
      landlordId: req.user!.userId,
      propertyId: req.params.id,
      tenantEmail: req.body.tenantEmail,
      rentAmount: req.body.rentAmount,
      moveInDate: req.body.moveInDate,
      installmentsAllowed: req.body.installmentsAllowed ?? false,
    },
    contextFrom(req)
  );

  res.status(201).json({ success: true, data: lease, timestamp: new Date() });
}

export async function getLeaseBalanceHandler(req: express.Request, res: express.Response): Promise<void> {
  const balance = await leaseService.getLeaseBalanceForUser({
    leaseId: req.params.leaseId,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  res.status(200).json({ success: true, data: balance, timestamp: new Date() });
}

export async function endLeaseHandler(req: express.Request, res: express.Response): Promise<void> {
  const lease = await leaseService.endLease(
    {
      landlordId: req.user!.userId,
      propertyId: req.params.id,
      leaseId: req.params.leaseId,
    },
    contextFrom(req)
  );

  res.status(200).json({ success: true, data: lease, timestamp: new Date() });
}

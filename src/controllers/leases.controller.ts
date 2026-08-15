import express from 'express';
import * as leaseService from '../services/lease.service';
import * as messageService from '../services/message.service';
import * as scoreService from '../services/score.service';

function contextFrom(req: express.Request) {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}

export async function assignTenantHandler(req: express.Request, res: express.Response): Promise<void> {
  const lease = await leaseService.assignTenant(
    {
      landlordId: req.user!.userId,
      propertyId: req.params.id,
      tenantEmail: req.body.tenantEmail,
      tenantPhone: req.body.tenantPhone,
      unitLabel: req.body.unitLabel,
      rentAmount: req.body.rentAmount,
      moveInDate: req.body.moveInDate,
      installmentsAllowed: req.body.installmentsAllowed ?? false,
      depositAmount: req.body.depositAmount,
      advanceRentAmount: req.body.advanceRentAmount,
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

export async function getArrearsHandler(req: express.Request, res: express.Response): Promise<void> {
  const arrears = await leaseService.getPropertyArrears({
    propertyId: req.params.id,
    landlordId: req.user!.userId,
  });

  res.status(200).json({ success: true, data: arrears, timestamp: new Date() });
}

export async function getTenantsHandler(req: express.Request, res: express.Response): Promise<void> {
  const tenants = await leaseService.listActiveTenantsForProperty({
    propertyId: req.params.id,
    landlordId: req.user!.userId,
  });

  res.status(200).json({ success: true, data: tenants, timestamp: new Date() });
}

export async function getTenantScoreHandler(req: express.Request, res: express.Response): Promise<void> {
  const score = await scoreService.getScoreForLandlord({
    propertyId: req.params.id,
    leaseId: req.params.leaseId,
    landlordId: req.user!.userId,
  });

  res.status(200).json({ success: true, data: score, timestamp: new Date() });
}

export async function getMessagesHandler(req: express.Request, res: express.Response): Promise<void> {
  const messages = await messageService.listConversation({
    propertyId: req.params.id,
    leaseId: req.params.leaseId,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  res.status(200).json({ success: true, data: messages, timestamp: new Date() });
}

export async function sendMessageHandler(req: express.Request, res: express.Response): Promise<void> {
  const message = await messageService.sendMessage({
    propertyId: req.params.id,
    leaseId: req.params.leaseId,
    senderId: req.user!.userId,
    role: req.user!.role,
    body: req.body.body,
  });

  res.status(201).json({ success: true, data: message, timestamp: new Date() });
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

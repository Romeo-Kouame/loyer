import {
  DisputeResolution,
  findPaymentById,
  listDisputedPayments,
  openPaymentDispute,
  PaymentRecord,
  resolvePaymentDispute,
} from '../repositories/payment.repository';
import { findPropertyById } from '../repositories/property.repository';
import { findUserById } from '../repositories/user.repository';
import { createRefund } from '../repositories/refund.repository';
import { cancelPayoutForRefund, holdPayoutForDispute, resumePayoutAfterDispute } from './payout.service';
import { notifyDisputeResolved } from './notification.service';
import { logAction } from './audit.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { RequestContext } from '../types';

export async function openDispute(
  params: { paymentId: string; userId: string; role: string; reason: string },
  context: RequestContext = {}
): Promise<PaymentRecord> {
  const payment = await findPaymentById(params.paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  const property = await findPropertyById(payment.propertyId);
  const isTenant = payment.tenantId === params.userId;
  const isLandlord = property?.ownerId === params.userId;
  if (params.role !== 'admin' && !isTenant && !isLandlord) {
    throw new ForbiddenError('You do not have permission to dispute this payment');
  }

  if (payment.status !== 'confirmed') {
    throw new ValidationError('Only confirmed payments can be disputed');
  }

  const updated = await openPaymentDispute(payment.id, { disputeReason: params.reason, disputedBy: params.userId });
  await holdPayoutForDispute(payment.id);

  await logAction({
    userId: params.userId,
    action: 'payment.disputed',
    resourceType: 'payment',
    resourceId: payment.id,
    metadata: { reason: params.reason },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return updated;
}

export async function listDisputes(params: { page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const { payments, total } = await listDisputedPayments({ limit: pageSize, offset });
  return { payments, total, page, pageSize };
}

export async function resolveDispute(
  params: { paymentId: string; adminId: string; resolution: DisputeResolution; notes?: string },
  context: RequestContext = {}
): Promise<PaymentRecord> {
  const payment = await findPaymentById(params.paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }
  if (payment.status !== 'disputed') {
    throw new ConflictError('This payment is not currently disputed');
  }

  const updated = await resolvePaymentDispute(payment.id, { resolution: params.resolution, notes: params.notes });

  if (params.resolution === 'confirmed') {
    await resumePayoutAfterDispute(payment.id);
  } else {
    const { payoutAlreadySent } = await cancelPayoutForRefund(payment.id);
    await createRefund({
      paymentId: payment.id,
      requestedBy: params.adminId,
      reason: params.notes,
      payoutAlreadySent,
    });
  }

  await logAction({
    userId: params.adminId,
    action: 'payment.dispute_resolved',
    resourceType: 'payment',
    resourceId: payment.id,
    metadata: { resolution: params.resolution, notes: params.notes },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  const property = await findPropertyById(payment.propertyId);
  const [tenant, landlord] = await Promise.all([
    findUserById(payment.tenantId),
    property ? findUserById(property.ownerId) : null,
  ]);

  if (tenant && landlord && property) {
    await notifyDisputeResolved({
      tenantEmail: tenant.email,
      landlordEmail: landlord.email,
      propertyAddress: property.address,
      resolution: params.resolution,
      notes: params.notes,
    });
  }

  return updated;
}

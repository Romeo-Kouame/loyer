import axios from 'axios';
import { config } from '../config/environment';
import { findPaymentById, PaymentRecord } from '../repositories/payment.repository';
import { findPropertyById } from '../repositories/property.repository';
import { findUserById, PayoutProvider, updatePayoutDestination, UserRecord } from '../repositories/user.repository';
import {
  createPayout,
  findDuePayouts,
  findPayoutById,
  findPayoutByPaymentId,
  findPayoutByTransactionId,
  listPayoutsForLandlord,
  PayoutRecord,
  PayoutStatus,
  setPayoutProcessing,
  setPayoutStatus,
} from '../repositories/payout.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { logAction } from './audit.service';
import { notifyPayoutCompleted } from './notification.service';
import { RequestContext } from '../types';

const kpayClient = axios.create({
  baseURL: config.kpay.baseUrl,
  headers: {
    'X-API-Key': config.kpay.apiKey,
    'X-Secret-Key': config.kpay.secretKey,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

// This deployment targets Côte d'Ivoire only - same mapping used for payment
// provider detection on the collection side.
const KPAY_PROVIDER_CODES: Record<PayoutProvider, string> = {
  mtn: 'MTN_MOMO_CIV',
  orange: 'ORANGE_CIV',
};

interface KpayWithdrawResponse {
  id: string;
  reference: string;
  status: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getHoldReason(landlord: UserRecord, propertyVerificationStatus: string): string | null {
  if (landlord.kycStatus !== 'verified') {
    return 'landlord_not_verified';
  }
  if (propertyVerificationStatus !== 'verified') {
    return 'property_not_verified';
  }
  if (!landlord.payoutProvider || !landlord.payoutPhoneNumber) {
    return 'no_payout_destination';
  }
  return null;
}

export async function setPayoutDestination(
  params: { userId: string; payoutProvider: PayoutProvider; payoutPhoneNumber: string },
  context: RequestContext = {}
): Promise<UserRecord> {
  const user = await updatePayoutDestination(params.userId, {
    payoutProvider: params.payoutProvider,
    payoutPhoneNumber: params.payoutPhoneNumber,
  });

  await logAction({
    userId: params.userId,
    action: 'landlord.payout_destination_updated',
    resourceType: 'user',
    resourceId: params.userId,
    metadata: { payoutProvider: params.payoutProvider },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return user;
}

async function attemptWithdrawal(payout: PayoutRecord, landlord: UserRecord): Promise<PayoutRecord> {
  try {
    const response = await kpayClient.post<KpayWithdrawResponse>('/api/v1/payments/withdraw', {
      amount: Number(payout.payoutAmount),
      provider: KPAY_PROVIDER_CODES[landlord.payoutProvider!],
      phoneNumber: landlord.payoutPhoneNumber,
      externalId: payout.id,
      description: 'Rent payout',
    });

    return await setPayoutProcessing(payout.id, {
      transactionId: response.data.id,
      providerReference: response.data.reference,
    });
  } catch (err) {
    logger.error(`K-Pay withdrawal failed for payout ${payout.id}: ${err}`);
    return await setPayoutStatus(payout.id, {
      status: 'failed',
      failureReason: axios.isAxiosError(err) ? err.response?.data?.message ?? err.message : String(err),
    });
  }
}

/** Creates the payout row on payment confirmation. Held for `reserveHoldHours`
 * before any withdrawal is attempted, leaving a window for a dispute. */
export async function createPayoutForPayment(payment: PaymentRecord): Promise<PayoutRecord> {
  const existing = await findPayoutByPaymentId(payment.id);
  if (existing) {
    return existing;
  }

  const property = await findPropertyById(payment.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found for payout');
  }

  const grossAmount = Number(payment.amount);
  const commissionAmount = round2(grossAmount * config.payouts.commissionRate);
  const payoutAmount = round2(grossAmount - commissionAmount);
  const scheduledFor = new Date(Date.now() + config.payouts.reserveHoldHours * 60 * 60 * 1000);

  const payout = await createPayout({
    paymentId: payment.id,
    landlordId: property.ownerId,
    grossAmount,
    commissionAmount,
    payoutAmount,
    status: 'pending',
    scheduledFor,
  });

  await logAction({
    userId: property.ownerId,
    action: 'payout.scheduled',
    resourceType: 'payout',
    resourceId: payout.id,
    metadata: { paymentId: payment.id, payoutAmount, scheduledFor: scheduledFor.toISOString() },
  });

  return payout;
}

async function processPayout(payout: PayoutRecord): Promise<PayoutRecord> {
  const landlord = await findUserById(payout.landlordId);
  if (!landlord) {
    return setPayoutStatus(payout.id, { status: 'failed', failureReason: 'Landlord not found' });
  }

  const payment = await findPaymentById(payout.paymentId);
  const property = payment ? await findPropertyById(payment.propertyId) : null;

  const holdReason = getHoldReason(landlord, property?.verificationStatus ?? 'unverified');
  if (holdReason) {
    const held = await setPayoutStatus(payout.id, { status: 'on_hold', holdReason });
    await logAction({
      userId: landlord.id,
      action: 'payout.on_hold',
      resourceType: 'payout',
      resourceId: payout.id,
      metadata: { holdReason },
    });
    return held;
  }

  const updated = await attemptWithdrawal(payout, landlord);

  await logAction({
    userId: landlord.id,
    action: updated.status === 'processing' ? 'payout.initiated' : 'payout.initiation_failed',
    resourceType: 'payout',
    resourceId: payout.id,
  });

  return updated;
}

/** Sweeps payouts whose reserve hold has elapsed and attempts them. Meant to
 * be called periodically by a background scheduler (see src/jobs). */
export async function processDuePayouts(): Promise<{ processed: number }> {
  const due = await findDuePayouts(new Date());
  for (const payout of due) {
    try {
      await processPayout(payout);
    } catch (err) {
      logger.error(`Failed to process due payout ${payout.id}: ${err}`);
    }
  }
  return { processed: due.length };
}

export async function retryPayout(
  params: { payoutId: string; requesterId: string; requesterRole: string },
  context: RequestContext = {}
): Promise<PayoutRecord> {
  const payout = await findPayoutById(params.payoutId);
  if (!payout) {
    throw new NotFoundError('Payout not found');
  }
  if (params.requesterRole !== 'admin' && payout.landlordId !== params.requesterId) {
    throw new ForbiddenError('You do not have permission to manage this payout');
  }
  if (payout.status !== 'on_hold' && payout.status !== 'failed') {
    throw new ValidationError('Only on-hold or failed payouts can be retried');
  }

  const updated = await processPayout(payout);

  await logAction({
    userId: payout.landlordId,
    action: 'payout.retry_attempted',
    resourceType: 'payout',
    resourceId: payout.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return updated;
}

export async function handlePayoutWebhookUpdate(payload: {
  paymentId: string;
  externalId?: string;
  status: string;
}): Promise<boolean> {
  const payout =
    (payload.externalId && (await findPayoutById(payload.externalId))) ??
    (await findPayoutByTransactionId(payload.paymentId));

  if (!payout) {
    return false;
  }

  const status: PayoutStatus = payload.status === 'COMPLETED' ? 'completed' : 'failed';

  await setPayoutStatus(payout.id, {
    status,
    completedAt: status === 'completed' ? new Date() : undefined,
    failureReason: status === 'failed' ? 'Reported failed by K-Pay' : undefined,
  });

  await logAction({
    userId: payout.landlordId,
    action: status === 'completed' ? 'payout.completed' : 'payout.failed',
    resourceType: 'payout',
    resourceId: payout.id,
  });

  if (status === 'completed') {
    const landlord = await findUserById(payout.landlordId);
    if (landlord) {
      await notifyPayoutCompleted({ landlordEmail: landlord.email, payoutAmount: payout.payoutAmount });
    }
  }

  return true;
}

export async function listMyPayouts(params: { landlordId: string; page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const { payouts, total } = await listPayoutsForLandlord({
    landlordId: params.landlordId,
    limit: pageSize,
    offset,
  });

  return { payouts, total, page, pageSize };
}

export async function holdPayoutForDispute(paymentId: string): Promise<void> {
  const payout = await findPayoutByPaymentId(paymentId);
  if (!payout || payout.status !== 'pending') {
    return;
  }

  await setPayoutStatus(payout.id, { status: 'on_hold', holdReason: 'payment_disputed' });
  await logAction({
    userId: payout.landlordId,
    action: 'payout.on_hold',
    resourceType: 'payout',
    resourceId: payout.id,
    metadata: { holdReason: 'payment_disputed' },
  });
}

export async function resumePayoutAfterDispute(paymentId: string): Promise<void> {
  const payout = await findPayoutByPaymentId(paymentId);
  if (!payout || payout.holdReason !== 'payment_disputed') {
    return;
  }

  await setPayoutStatus(payout.id, { status: 'pending', holdReason: null, scheduledFor: new Date() });
  await logAction({
    userId: payout.landlordId,
    action: 'payout.resumed',
    resourceType: 'payout',
    resourceId: payout.id,
  });
}

export async function cancelPayoutForRefund(paymentId: string): Promise<{ payoutAlreadySent: boolean }> {
  const payout = await findPayoutByPaymentId(paymentId);
  if (!payout) {
    return { payoutAlreadySent: false };
  }

  if (payout.status === 'processing' || payout.status === 'completed') {
    return { payoutAlreadySent: true };
  }

  await setPayoutStatus(payout.id, { status: 'failed', failureReason: 'Payment refunded' });
  await logAction({
    userId: payout.landlordId,
    action: 'payout.cancelled_for_refund',
    resourceType: 'payout',
    resourceId: payout.id,
  });

  return { payoutAlreadySent: false };
}

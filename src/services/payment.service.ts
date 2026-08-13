import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/environment';
import { findPropertyById } from '../repositories/property.repository';
import {
  createPendingPayment,
  findPaymentById,
  findPaymentByTransactionId,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  setPaymentInitiated,
  updatePaymentStatus,
} from '../repositories/payment.repository';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

const kpayClient = axios.create({
  baseURL: config.kpay.baseUrl,
  headers: {
    'X-API-Key': config.kpay.apiKey,
    'X-Secret-Key': config.kpay.secretKey,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

interface KpayPaymentResponse {
  id: string;
  reference: string;
  status: string;
  provider: string | null;
  gatewayUrl?: string;
  expiresAt?: string;
}

function mapKpayStatus(status: string): PaymentStatus {
  switch (status) {
    case 'COMPLETED':
      return 'confirmed';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    default:
      return 'pending';
  }
}

// K-Pay's per-country provider codes (e.g. "MTN_MOMO_CIV") map back to our
// generic provider enum. Any operator/method outside this set (cards, other
// countries) is left unset - this deployment only tracks MTN/Orange.
function mapKpayProviderCode(code: string | null): PaymentProvider | null {
  if (!code) return null;
  if (code.startsWith('MTN_MOMO')) return 'mtn';
  if (code.startsWith('ORANGE')) return 'orange';
  return null;
}

export interface InitiatedPayment extends PaymentRecord {
  gatewayUrl: string;
  expiresAt: string | null;
}

export async function initiatePayment(params: {
  tenantId: string;
  propertyId: string;
  amount: number;
  returnUrl: string;
  cancelUrl?: string;
  description?: string;
}): Promise<InitiatedPayment> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }

  const payment = await createPendingPayment({
    tenantId: params.tenantId,
    propertyId: params.propertyId,
    amount: params.amount,
  });

  try {
    const response = await kpayClient.post<KpayPaymentResponse>('/api/v1/payments/init', {
      amount: params.amount,
      returnUrl: params.returnUrl,
      cancelUrl: params.cancelUrl,
      externalId: payment.id,
      description: params.description,
    });

    const updated = await setPaymentInitiated(payment.id, {
      transactionId: response.data.id,
      providerReference: response.data.reference,
      status: mapKpayStatus(response.data.status),
    });

    return {
      ...updated,
      gatewayUrl: response.data.gatewayUrl ?? '',
      expiresAt: response.data.expiresAt ?? null,
    };
  } catch (err) {
    logger.error(`K-Pay payment initiation failed for payment ${payment.id}: ${err}`);
    await updatePaymentStatus(payment.id, 'failed');
    throw new AppError('Payment initiation failed with the payment provider', 502, 'PAYMENT_PROVIDER_ERROR');
  }
}

export async function getPaymentStatus(params: {
  paymentId: string;
  userId: string;
  role: string;
}): Promise<PaymentRecord> {
  const payment = await findPaymentById(params.paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  if (params.role === 'tenant' && payment.tenantId !== params.userId) {
    throw new ForbiddenError('You do not have permission to view this payment');
  }

  if (payment.status === 'pending' && payment.transactionId) {
    try {
      const response = await kpayClient.get<KpayPaymentResponse>(`/api/v1/payments/${payment.transactionId}`);
      const mappedStatus = mapKpayStatus(response.data.status);
      const mappedProvider = mapKpayProviderCode(response.data.provider);

      if (mappedStatus !== payment.status || (mappedProvider && !payment.provider)) {
        return await updatePaymentStatus(payment.id, mappedStatus, { provider: mappedProvider });
      }
    } catch (err) {
      logger.warn(`Failed to poll K-Pay status for payment ${payment.id}: ${err}`);
    }
  }

  return payment;
}

export interface KpayWebhookPayload {
  event: string;
  paymentId: string;
  reference: string;
  status: string;
  externalId: string;
}

export async function handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!config.kpay.webhookSecret) {
    throw new AppError('K-Pay webhook secret is not configured', 500, 'WEBHOOK_NOT_CONFIGURED');
  }

  if (!signature) {
    throw new UnauthorizedError('Missing webhook signature');
  }

  const expected = crypto.createHmac('sha256', config.kpay.webhookSecret).update(rawBody).digest('hex');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new UnauthorizedError('Invalid webhook signature');
  }

  const payload = JSON.parse(rawBody.toString()) as KpayWebhookPayload;

  const payment =
    (payload.externalId && (await findPaymentById(payload.externalId))) ??
    (await findPaymentByTransactionId(payload.paymentId));

  if (!payment) {
    logger.warn(`K-Pay webhook received for unknown payment: ${payload.externalId ?? payload.paymentId}`);
    return;
  }

  const status = mapKpayStatus(payload.status);
  let provider: PaymentProvider | null = null;

  // The webhook payload doesn't carry the provider; fetch it once the
  // payment is settled so we still record which operator was used.
  if (status !== 'pending' && !payment.provider && payment.transactionId) {
    try {
      const response = await kpayClient.get<KpayPaymentResponse>(`/api/v1/payments/${payment.transactionId}`);
      provider = mapKpayProviderCode(response.data.provider);
    } catch (err) {
      logger.warn(`Failed to fetch provider for settled payment ${payment.id}: ${err}`);
    }
  }

  await updatePaymentStatus(payment.id, status, { webhookReceivedAt: new Date(), provider });
}

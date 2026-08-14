import { findRefundById, listRefunds as listRefundsRecords, markRefundCompleted, RefundStatus } from '../repositories/refund.repository';
import { logAction } from './audit.service';
import { ConflictError, NotFoundError } from '../utils/errors';
import { RequestContext } from '../types';

export async function listRefunds(params: { status?: RefundStatus; page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const { refunds, total } = await listRefundsRecords({ status: params.status, limit: pageSize, offset });
  return { refunds, total, page, pageSize };
}

export async function completeRefund(
  params: { refundId: string; adminId: string; adminNotes?: string },
  context: RequestContext = {}
) {
  const refund = await findRefundById(params.refundId);
  if (!refund) {
    throw new NotFoundError('Refund not found');
  }
  if (refund.status !== 'pending') {
    throw new ConflictError('This refund has already been processed');
  }

  const updated = await markRefundCompleted(refund.id, params.adminNotes);

  await logAction({
    userId: params.adminId,
    action: 'refund.completed',
    resourceType: 'refund',
    resourceId: refund.id,
    metadata: { paymentId: refund.paymentId },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return updated;
}

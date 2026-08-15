import { findLeaseById, LeaseRecord } from '../repositories/lease.repository';
import { findPropertyById } from '../repositories/property.repository';
import {
  countUnreadForUser,
  createMessage,
  listMessagesForLease,
  markMessagesRead,
  MessageRecord,
} from '../repositories/message.repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';

async function assertParticipant(params: {
  propertyId: string;
  leaseId: string;
  userId: string;
  role: string;
}): Promise<LeaseRecord> {
  const lease = await findLeaseById(params.leaseId);
  if (!lease || lease.propertyId !== params.propertyId) {
    throw new NotFoundError('Lease not found');
  }

  if (params.role === 'tenant') {
    if (lease.tenantId !== params.userId) {
      throw new ForbiddenError('You do not have permission to view this conversation');
    }
    return lease;
  }

  if (params.role === 'landlord') {
    const property = await findPropertyById(params.propertyId);
    if (!property || property.ownerId !== params.userId) {
      throw new ForbiddenError('You do not have permission to view this conversation');
    }
    return lease;
  }

  throw new ForbiddenError('You do not have permission to view this conversation');
}

export async function listConversation(params: {
  propertyId: string;
  leaseId: string;
  userId: string;
  role: string;
}): Promise<MessageRecord[]> {
  await assertParticipant(params);
  const messages = await listMessagesForLease(params.leaseId);
  await markMessagesRead(params.leaseId, params.userId);
  return messages;
}

export async function sendMessage(params: {
  propertyId: string;
  leaseId: string;
  senderId: string;
  role: string;
  body: string;
}): Promise<MessageRecord> {
  await assertParticipant({ propertyId: params.propertyId, leaseId: params.leaseId, userId: params.senderId, role: params.role });
  return createMessage({ leaseId: params.leaseId, senderId: params.senderId, body: params.body });
}

export async function getUnreadCount(leaseId: string, userId: string): Promise<number> {
  return countUnreadForUser(leaseId, userId);
}

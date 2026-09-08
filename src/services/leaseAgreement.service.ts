import { findLeaseById } from '../repositories/lease.repository';
import { findPropertyById } from '../repositories/property.repository';
import { findUserById } from '../repositories/user.repository';
import {
  createAgreement,
  createSignature,
  findAgreementByLeaseId,
  listSignaturesForAgreement,
  SignerRole,
} from '../repositories/leaseAgreement.repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { logAction } from './audit.service';
import { RequestContext } from '../types';

export interface LeaseAgreementView {
  id: string;
  leaseId: string;
  propertyAddress: string;
  unitLabel: string | null;
  rentAmount: number;
  depositAmount: number | null;
  advanceRentAmount: number | null;
  installmentsAllowed: boolean;
  moveInDate: string;
  landlordName: string;
  tenantName: string;
  createdAt: Date;
  landlordSignedAt: Date | null;
  tenantSignedAt: Date | null;
  isFullyExecuted: boolean;
}

async function assertPartyToLease(params: {
  propertyId: string;
  leaseId: string;
  userId: string;
  role: string;
}): Promise<{ landlordId: string; tenantId: string; role: SignerRole }> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  const lease = await findLeaseById(params.leaseId);
  if (!lease || lease.propertyId !== params.propertyId) {
    throw new NotFoundError('Lease not found');
  }

  if (params.role === 'landlord' && property.ownerId === params.userId) {
    return { landlordId: property.ownerId, tenantId: lease.tenantId, role: 'landlord' };
  }
  if (params.role === 'tenant' && lease.tenantId === params.userId) {
    return { landlordId: property.ownerId, tenantId: lease.tenantId, role: 'tenant' };
  }

  throw new ForbiddenError('You are not a party to this lease');
}

function buildView(
  agreement: { id: string; leaseId: string; propertyAddress: string; unitLabel: string | null; rentAmount: string; depositAmount: string | null; advanceRentAmount: string | null; installmentsAllowed: boolean; moveInDate: string; landlordName: string; tenantName: string; createdAt: Date },
  landlordSignedAt: Date | null,
  tenantSignedAt: Date | null
): LeaseAgreementView {
  return {
    id: agreement.id,
    leaseId: agreement.leaseId,
    propertyAddress: agreement.propertyAddress,
    unitLabel: agreement.unitLabel,
    rentAmount: Number(agreement.rentAmount),
    depositAmount: agreement.depositAmount ? Number(agreement.depositAmount) : null,
    advanceRentAmount: agreement.advanceRentAmount ? Number(agreement.advanceRentAmount) : null,
    installmentsAllowed: agreement.installmentsAllowed,
    moveInDate: agreement.moveInDate,
    landlordName: agreement.landlordName,
    tenantName: agreement.tenantName,
    createdAt: agreement.createdAt,
    landlordSignedAt,
    tenantSignedAt,
    isFullyExecuted: landlordSignedAt !== null && tenantSignedAt !== null,
  };
}

async function getOrCreateAgreementRecord(propertyId: string, leaseId: string) {
  const existing = await findAgreementByLeaseId(leaseId);
  if (existing) {
    return existing;
  }

  const property = await findPropertyById(propertyId);
  const lease = await findLeaseById(leaseId);
  if (!property || !lease) {
    throw new NotFoundError('Property or lease not found');
  }

  const [landlord, tenant] = await Promise.all([findUserById(property.ownerId), findUserById(lease.tenantId)]);
  if (!landlord || !tenant) {
    throw new NotFoundError('Landlord or tenant account not found');
  }

  return createAgreement({
    leaseId,
    propertyAddress: property.address,
    unitLabel: lease.unitLabel,
    rentAmount: Number(lease.rentAmount),
    depositAmount: lease.depositAmount ? Number(lease.depositAmount) : null,
    advanceRentAmount: lease.advanceRentAmount ? Number(lease.advanceRentAmount) : null,
    installmentsAllowed: lease.installmentsAllowed,
    moveInDate: lease.moveInDate,
    landlordName: landlord.name,
    tenantName: tenant.name,
  });
}

export async function getOrCreateAgreement(params: {
  propertyId: string;
  leaseId: string;
  userId: string;
  role: string;
}): Promise<LeaseAgreementView> {
  await assertPartyToLease(params);
  const agreement = await getOrCreateAgreementRecord(params.propertyId, params.leaseId);
  const signatures = await listSignaturesForAgreement(agreement.id);
  const landlordSignedAt = signatures.find((s) => s.role === 'landlord')?.signedAt ?? null;
  const tenantSignedAt = signatures.find((s) => s.role === 'tenant')?.signedAt ?? null;
  return buildView(agreement, landlordSignedAt, tenantSignedAt);
}

export async function signAgreement(
  params: {
    propertyId: string;
    leaseId: string;
    userId: string;
    role: string;
    fullName: string;
  },
  context: RequestContext = {}
): Promise<LeaseAgreementView> {
  const { role } = await assertPartyToLease(params);

  if (!params.fullName.trim()) {
    throw new ValidationError('Full name is required to sign');
  }

  const agreement = await getOrCreateAgreementRecord(params.propertyId, params.leaseId);
  const existingSignatures = await listSignaturesForAgreement(agreement.id);
  if (existingSignatures.some((s) => s.role === role)) {
    throw new ConflictError('You have already signed this agreement');
  }

  await createSignature({
    agreementId: agreement.id,
    userId: params.userId,
    role,
    fullNameTyped: params.fullName.trim(),
    ipAddress: context.ipAddress ?? null,
  });

  await logAction({
    userId: params.userId,
    action: 'lease_agreement.signed',
    resourceType: 'lease_agreement',
    resourceId: agreement.id,
    metadata: { leaseId: params.leaseId, role },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  const signatures = await listSignaturesForAgreement(agreement.id);
  const landlordSignedAt = signatures.find((s) => s.role === 'landlord')?.signedAt ?? null;
  const tenantSignedAt = signatures.find((s) => s.role === 'tenant')?.signedAt ?? null;
  return buildView(agreement, landlordSignedAt, tenantSignedAt);
}

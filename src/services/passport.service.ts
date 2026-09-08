import crypto from 'crypto';
import {
  createPassportToken,
  findActivePassportToken,
  findPassportTokenByToken,
  revokeActivePassportTokens,
} from '../repositories/passport.repository';
import { findEarliestLeaseDateForTenant } from '../repositories/lease.repository';
import { findUserById } from '../repositories/user.repository';
import { computeTenantScore, TenantGrade } from './score.service';
import { NotFoundError } from '../utils/errors';

export interface PublicTenantPassport {
  tenantName: string;
  score: number;
  grade: TenantGrade;
  confirmedPayments: number;
  activeLeasesCount: number;
  memberSince: string | null;
  generatedAt: string;
}

export async function getOrCreateShareToken(tenantId: string): Promise<string> {
  const existing = await findActivePassportToken(tenantId);
  if (existing) {
    return existing.token;
  }
  const token = crypto.randomBytes(24).toString('hex');
  const created = await createPassportToken(tenantId, token);
  return created.token;
}

export async function revokeShareToken(tenantId: string): Promise<void> {
  await revokeActivePassportTokens(tenantId);
}

export async function getPublicPassport(token: string): Promise<PublicTenantPassport> {
  const tokenRecord = await findPassportTokenByToken(token);
  if (!tokenRecord) {
    throw new NotFoundError('Ce passeport est introuvable ou son lien a été révoqué');
  }

  const [tenant, score, earliestLeaseDate] = await Promise.all([
    findUserById(tokenRecord.tenantId),
    computeTenantScore(tokenRecord.tenantId),
    findEarliestLeaseDateForTenant(tokenRecord.tenantId),
  ]);

  if (!tenant) {
    throw new NotFoundError('Locataire introuvable');
  }

  return {
    tenantName: tenant.name,
    score: score.score,
    grade: score.grade,
    confirmedPayments: score.confirmedPayments,
    activeLeasesCount: score.activeLeasesCount,
    memberSince: earliestLeaseDate ? earliestLeaseDate.toISOString().slice(0, 10) : null,
    generatedAt: new Date().toISOString(),
  };
}

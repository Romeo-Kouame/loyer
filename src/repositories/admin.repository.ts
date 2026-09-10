import { pool } from '../config/database';

export interface PlatformOverview {
  totalLandlords: number;
  totalTenants: number;
  totalProperties: number;
  totalActiveLeases: number;
  confirmedPaymentsCount: number;
  confirmedPaymentsAmount: number;
  pendingKycCount: number;
  pendingPropertyVerificationCount: number;
  disputedPaymentsCount: number;
  pendingRefundsCount: number;
  completedPayoutsAmount: number;
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [
    userCounts,
    propertyCount,
    leaseCount,
    payments,
    pendingKyc,
    pendingVerifications,
    disputedPayments,
    pendingRefunds,
    payouts,
  ] = await Promise.all([
    pool.query<{ role: string; count: string }>(
      'SELECT role, COUNT(*) AS count FROM "users" WHERE "deletedAt" IS NULL GROUP BY role'
    ),
    pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM "properties" WHERE "deletedAt" IS NULL'),
    pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM "leases" WHERE status = \'active\''),
    pool.query<{ count: string; total: string }>(
      'SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM "payments" WHERE status = \'confirmed\''
    ),
    pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM "users" WHERE "kycStatus" = \'pending\' AND "kycSubmittedAt" IS NOT NULL'),
    pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM "properties" WHERE "verificationStatus" = \'pending_review\''),
    pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM "payments" WHERE status = \'disputed\''),
    pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM "refunds" WHERE status = \'pending\''),
    pool.query<{ total: string }>('SELECT COALESCE(SUM("payoutAmount"), 0) AS total FROM "payouts" WHERE status = \'completed\''),
  ]);

  const roleCount = (role: string) => Number(userCounts.rows.find((r) => r.role === role)?.count ?? 0);

  return {
    totalLandlords: roleCount('landlord'),
    totalTenants: roleCount('tenant'),
    totalProperties: Number(propertyCount.rows[0].count),
    totalActiveLeases: Number(leaseCount.rows[0].count),
    confirmedPaymentsCount: Number(payments.rows[0].count),
    confirmedPaymentsAmount: Number(payments.rows[0].total),
    pendingKycCount: Number(pendingKyc.rows[0].count),
    pendingPropertyVerificationCount: Number(pendingVerifications.rows[0].count),
    disputedPaymentsCount: Number(disputedPayments.rows[0].count),
    pendingRefundsCount: Number(pendingRefunds.rows[0].count),
    completedPayoutsAmount: Number(payouts.rows[0].total),
  };
}

export interface PlatformUserSummary {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: 'landlord' | 'tenant' | 'admin';
  kycStatus: string;
  createdAt: Date;
}

export async function listAllUsers(params: {
  role?: string;
  limit: number;
  offset: number;
}): Promise<{ users: PlatformUserSummary[]; total: number }> {
  const conditions = ['"deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (params.role) {
    values.push(params.role);
    conditions.push(`role = $${values.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM "users" ${whereClause}`, values);

  values.push(params.limit);
  values.push(params.offset);

  const usersResult = await pool.query<PlatformUserSummary>(
    `SELECT id, email, phone, name, role, "kycStatus", "createdAt" FROM "users" ${whereClause}
     ORDER BY "createdAt" DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { users: usersResult.rows, total: Number(countResult.rows[0].count) };
}

export interface AdminUserDetail {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: 'landlord' | 'tenant' | 'admin';
  isPremium: boolean;
  kycStatus: string;
  kycSubmittedAt: Date | null;
  kycReviewedAt: Date | null;
  kycRejectionReason: string | null;
  hasKycDocument: boolean;
  payoutProvider: string | null;
  payoutPhoneNumber: string | null;
  emailRemindersEnabled: boolean;
  hasProfilePicture: boolean;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  activitySector: string | null;
  profession: string | null;
  secondPhone: string | null;
  currentAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: Date;
}

// A separate, admin-only column list (never selects passwordHash, and turns
// the file-path columns into booleans) rather than reusing the shared
// user.repository helpers, so a future change to the "my own profile" shape
// can't accidentally change what this exposes to admins, or vice versa.
export async function findUserDetailById(userId: string): Promise<AdminUserDetail | null> {
  const result = await pool.query<AdminUserDetail>(
    `SELECT id, email, phone, name, role, "isPremium", "kycStatus", "kycSubmittedAt", "kycReviewedAt", "kycRejectionReason",
            ("kycDocumentPath" IS NOT NULL) AS "hasKycDocument",
            "payoutProvider", "payoutPhoneNumber", "emailRemindersEnabled",
            ("profilePicturePath" IS NOT NULL) AS "hasProfilePicture",
            "firstName", "lastName", "dateOfBirth", "placeOfBirth", "nationality", "idDocumentType", "idDocumentNumber",
            "activitySector", "profession", "secondPhone", "currentAddress", "emergencyContactName", "emergencyContactPhone",
            "createdAt"
     FROM "users"
     WHERE id = $1 AND "deletedAt" IS NULL`,
    [userId]
  );
  return result.rows[0] ?? null;
}

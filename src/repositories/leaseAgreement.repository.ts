import { pool } from '../config/database';

export type SignerRole = 'landlord' | 'tenant';

export interface LeaseAgreementRecord {
  id: string;
  leaseId: string;
  propertyAddress: string;
  unitLabel: string | null;
  rentAmount: string;
  depositAmount: string | null;
  advanceRentAmount: string | null;
  installmentsAllowed: boolean;
  moveInDate: string;
  landlordName: string;
  tenantName: string;
  createdAt: Date;
}

export interface LeaseAgreementSignatureRecord {
  id: string;
  agreementId: string;
  userId: string;
  role: SignerRole;
  fullNameTyped: string;
  ipAddress: string | null;
  signedAt: Date;
}

const AGREEMENT_COLUMNS = `id, "leaseId", "propertyAddress", "unitLabel", "rentAmount", "depositAmount",
  "advanceRentAmount", "installmentsAllowed", "moveInDate", "landlordName", "tenantName", "createdAt"`;

const SIGNATURE_COLUMNS = `id, "agreementId", "userId", role, "fullNameTyped", "ipAddress", "signedAt"`;

export async function findAgreementByLeaseId(leaseId: string): Promise<LeaseAgreementRecord | null> {
  const result = await pool.query<LeaseAgreementRecord>(
    `SELECT ${AGREEMENT_COLUMNS} FROM "lease_agreements" WHERE "leaseId" = $1`,
    [leaseId]
  );
  return result.rows[0] ?? null;
}

export async function createAgreement(params: {
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
}): Promise<LeaseAgreementRecord> {
  const result = await pool.query<LeaseAgreementRecord>(
    `INSERT INTO "lease_agreements"
       ("leaseId", "propertyAddress", "unitLabel", "rentAmount", "depositAmount", "advanceRentAmount",
        "installmentsAllowed", "moveInDate", "landlordName", "tenantName")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${AGREEMENT_COLUMNS}`,
    [
      params.leaseId,
      params.propertyAddress,
      params.unitLabel,
      params.rentAmount,
      params.depositAmount,
      params.advanceRentAmount,
      params.installmentsAllowed,
      params.moveInDate,
      params.landlordName,
      params.tenantName,
    ]
  );
  return result.rows[0];
}

export async function listSignaturesForAgreement(agreementId: string): Promise<LeaseAgreementSignatureRecord[]> {
  const result = await pool.query<LeaseAgreementSignatureRecord>(
    `SELECT ${SIGNATURE_COLUMNS} FROM "lease_agreement_signatures" WHERE "agreementId" = $1`,
    [agreementId]
  );
  return result.rows;
}

export async function createSignature(params: {
  agreementId: string;
  userId: string;
  role: SignerRole;
  fullNameTyped: string;
  ipAddress: string | null;
}): Promise<LeaseAgreementSignatureRecord> {
  const result = await pool.query<LeaseAgreementSignatureRecord>(
    `INSERT INTO "lease_agreement_signatures" ("agreementId", "userId", role, "fullNameTyped", "ipAddress")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SIGNATURE_COLUMNS}`,
    [params.agreementId, params.userId, params.role, params.fullNameTyped, params.ipAddress]
  );
  return result.rows[0];
}

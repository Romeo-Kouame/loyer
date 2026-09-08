-- Formalizes an already-active lease into a document both parties can sign
-- in-app. The agreement snapshots the terms at generation time (not a live
-- view of the lease) so a later rent/lease edit never silently changes what
-- was actually signed. This is a lightweight, typed-name e-signature with an
-- audit trail (timestamp + IP) - it documents the parties' agreement inside
-- the platform, it does not assert notarial or legal equivalence.
CREATE TABLE IF NOT EXISTS "lease_agreements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leaseId" UUID NOT NULL UNIQUE REFERENCES "leases"("id") ON DELETE CASCADE,
  "propertyAddress" TEXT NOT NULL,
  "unitLabel" VARCHAR(255),
  "rentAmount" DECIMAL(12, 2) NOT NULL,
  "depositAmount" DECIMAL(12, 2),
  "advanceRentAmount" DECIMAL(12, 2),
  "installmentsAllowed" BOOLEAN NOT NULL,
  "moveInDate" DATE NOT NULL,
  "landlordName" VARCHAR(255) NOT NULL,
  "tenantName" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "lease_agreement_signatures" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agreementId" UUID NOT NULL REFERENCES "lease_agreements"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" VARCHAR(20) NOT NULL,
  "fullNameTyped" VARCHAR(255) NOT NULL,
  "ipAddress" VARCHAR(64),
  "signedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK ("role" IN ('landlord', 'tenant')),
  UNIQUE ("agreementId", "role")
);

CREATE INDEX idx_lease_agreements_leaseId ON "lease_agreements"("leaseId");
CREATE INDEX idx_lease_agreement_signatures_agreementId ON "lease_agreement_signatures"("agreementId");

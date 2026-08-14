-- Where a landlord wants to receive their payouts. Separate from their
-- account phone: a landlord may want rent paid out to a different
-- MTN/Orange number than the one they log in with.
ALTER TABLE "users" ADD COLUMN "payoutProvider" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN "payoutPhoneNumber" VARCHAR(20);
ALTER TABLE "users" ADD CONSTRAINT users_payoutProvider_check
  CHECK ("payoutProvider" IS NULL OR "payoutProvider" IN ('mtn', 'orange'));

-- One payout per confirmed payment: the platform takes its commission and
-- automatically pushes the rest to the landlord's payout destination via
-- K-Pay's withdrawal API. Held (not attempted) if the landlord/property
-- isn't verified yet, or no payout destination is set.
CREATE TABLE IF NOT EXISTS "payouts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "paymentId" UUID NOT NULL UNIQUE REFERENCES "payments"("id") ON DELETE CASCADE,
  "landlordId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "grossAmount" DECIMAL(12, 2) NOT NULL,
  "commissionAmount" DECIMAL(12, 2) NOT NULL,
  "payoutAmount" DECIMAL(12, 2) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "holdReason" VARCHAR(255),
  "transactionId" VARCHAR(255) UNIQUE,
  "providerReference" VARCHAR(255),
  "failureReason" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,

  CHECK ("status" IN ('pending', 'on_hold', 'processing', 'completed', 'failed')),
  CHECK ("grossAmount" > 0),
  CHECK ("commissionAmount" >= 0),
  CHECK ("payoutAmount" >= 0)
);

CREATE INDEX idx_payouts_landlordId ON "payouts"("landlordId");
CREATE INDEX idx_payouts_status ON "payouts"("status");

-- Disputes live directly on the payment (one active dispute at a time is
-- the realistic case for an MVP) rather than a separate table.
ALTER TABLE "payments" ADD COLUMN "disputeReason" VARCHAR(500);
ALTER TABLE "payments" ADD COLUMN "disputedBy" UUID REFERENCES "users"("id");
ALTER TABLE "payments" ADD COLUMN "disputedAt" TIMESTAMP;
ALTER TABLE "payments" ADD COLUMN "disputeResolution" VARCHAR(50);
ALTER TABLE "payments" ADD COLUMN "disputeResolutionNotes" VARCHAR(500);
ALTER TABLE "payments" ADD COLUMN "disputeResolvedAt" TIMESTAMP;

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT conname INTO existing_constraint
  FROM pg_constraint
  WHERE conrelid = '"payments"'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "payments" DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE "payments" ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'confirmed', 'failed', 'disputed', 'refunded'));

-- K-Pay has no refund API - a refund is executed manually by an operator
-- (K-Pay dashboard or direct transfer) and just tracked here.
CREATE TABLE IF NOT EXISTS "refunds" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "paymentId" UUID NOT NULL UNIQUE REFERENCES "payments"("id") ON DELETE CASCADE,
  "requestedBy" UUID NOT NULL REFERENCES "users"("id"),
  "reason" VARCHAR(500),
  "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "payoutAlreadySent" BOOLEAN NOT NULL DEFAULT false,
  "adminNotes" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,

  CHECK ("status" IN ('pending', 'completed', 'rejected'))
);

CREATE INDEX idx_refunds_status ON "refunds"("status");

-- Reserve hold: a payout isn't attempted immediately on payment confirmation
-- anymore, only once scheduledFor has passed, leaving a window for disputes.
ALTER TABLE "payouts" ADD COLUMN "scheduledFor" TIMESTAMP;
UPDATE "payouts" SET "scheduledFor" = "createdAt" WHERE "scheduledFor" IS NULL;
ALTER TABLE "payouts" ALTER COLUMN "scheduledFor" SET NOT NULL;
CREATE INDEX idx_payouts_scheduledFor ON "payouts"("scheduledFor");

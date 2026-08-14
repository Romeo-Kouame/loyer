-- Rent amount and move-in date are set per lease by the landlord (prices vary
-- by property), and drive the due-date/late calculation. installmentsAllowed
-- controls whether a tenant may pay less than the outstanding balance.
ALTER TABLE "leases" ADD COLUMN "rentAmount" DECIMAL(12, 2);
ALTER TABLE "leases" ADD COLUMN "moveInDate" DATE;
ALTER TABLE "leases" ADD COLUMN "installmentsAllowed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "leases" SET "rentAmount" = 0, "moveInDate" = "createdAt"::date
WHERE "rentAmount" IS NULL;

ALTER TABLE "leases" ALTER COLUMN "rentAmount" SET NOT NULL;
ALTER TABLE "leases" ALTER COLUMN "moveInDate" SET NOT NULL;
ALTER TABLE "leases" ADD CONSTRAINT leases_rentAmount_check CHECK ("rentAmount" > 0);

-- Explicit link from a payment to the lease it applies to, so a tenant's
-- balance is never ambiguous across successive leases on the same property.
ALTER TABLE "payments" ADD COLUMN "leaseId" UUID REFERENCES "leases"("id");
CREATE INDEX idx_payments_leaseId ON "payments"("leaseId");

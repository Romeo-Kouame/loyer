ALTER TABLE "leases" ADD COLUMN "depositAmount" DECIMAL(12,2);
ALTER TABLE "leases" ADD COLUMN "depositPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leases" ADD COLUMN "advanceRentAmount" DECIMAL(12,2);
ALTER TABLE "leases" ADD COLUMN "advanceRentPaid" BOOLEAN NOT NULL DEFAULT false;

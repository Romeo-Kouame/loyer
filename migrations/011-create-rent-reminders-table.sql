-- Dedup table for the rent reminder scheduler: one row per (lease, billing
-- period, reminder type) so a daily sweep never emails the same reminder twice.
CREATE TABLE IF NOT EXISTS "rent_reminders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE CASCADE,
  "periodDueDate" DATE NOT NULL,
  "reminderType" VARCHAR(20) NOT NULL,
  "sentAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK ("reminderType" IN ('due_soon_7', 'due_soon_3', 'due_today', 'overdue_7', 'overdue_30', 'overdue_90')),
  UNIQUE ("leaseId", "periodDueDate", "reminderType")
);

CREATE INDEX idx_rent_reminders_lease ON "rent_reminders"("leaseId");

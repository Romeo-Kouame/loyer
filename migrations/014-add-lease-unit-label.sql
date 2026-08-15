-- Distinguishes which physical unit a lease is for on a multi-apartment
-- property (e.g. "Appt A", "RDC", "2eme etage"). Nullable so existing leases
-- created before this column don't need a backfill; new leases are required
-- (by application validation) to set one.
ALTER TABLE "leases" ADD COLUMN "unitLabel" VARCHAR(50);

-- Two tenants can't simultaneously claim the same labeled unit on the same
-- property. Only enforced once a lease actually has a label - old rows with
-- unitLabel IS NULL are exempt so this doesn't break on existing data.
CREATE UNIQUE INDEX idx_leases_active_unit_unique ON "leases"("propertyId", "unitLabel")
  WHERE "status" = 'active' AND "unitLabel" IS NOT NULL;

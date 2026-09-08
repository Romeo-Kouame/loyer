ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "propertyType" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "surfaceArea" NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS "bedroomCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "bathroomCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlyRent" NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE "properties"
  ADD CONSTRAINT properties_surfaceArea_check CHECK ("surfaceArea" IS NULL OR "surfaceArea" > 0),
  ADD CONSTRAINT properties_bedroomCount_check CHECK ("bedroomCount" IS NULL OR "bedroomCount" >= 0),
  ADD CONSTRAINT properties_bathroomCount_check CHECK ("bathroomCount" IS NULL OR "bathroomCount" >= 0),
  ADD CONSTRAINT properties_monthlyRent_check CHECK ("monthlyRent" >= 0);

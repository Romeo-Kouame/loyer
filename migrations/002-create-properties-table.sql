-- Create properties table
CREATE TABLE IF NOT EXISTS "properties" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "address" VARCHAR(500) NOT NULL,
  "numberOfApartments" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  
  CHECK ("numberOfApartments" > 0)
);

CREATE INDEX idx_properties_ownerId ON "properties"("ownerId");
CREATE INDEX idx_properties_createdAt ON "properties"("createdAt");

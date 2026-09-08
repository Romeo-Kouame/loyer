CREATE TABLE IF NOT EXISTS "property_photos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "path" VARCHAR(500) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_property_photos_property ON "property_photos"("propertyId");

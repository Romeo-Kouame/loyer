-- Restrict payments.provider to providers supported by the K-Pay aggregator
-- (Wave is not supported by K-Pay), and track the aggregator's own reference.
DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT conname INTO existing_constraint
  FROM pg_constraint
  WHERE conrelid = '"payments"'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%provider%IN%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "payments" DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

-- Nullable: this K-Pay account is configured in GATEWAY mode, where the
-- customer picks their operator on the hosted page - the provider is only
-- known once K-Pay reports it back (via status poll or webhook).
ALTER TABLE "payments" ALTER COLUMN "provider" DROP NOT NULL;
ALTER TABLE "payments" ADD CONSTRAINT payments_provider_check CHECK ("provider" IS NULL OR "provider" IN ('mtn', 'orange'));

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "providerReference" VARCHAR(255);

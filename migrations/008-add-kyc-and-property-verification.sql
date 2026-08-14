-- KYC: identity document submitted by any user, reviewed manually by an admin.
ALTER TABLE "users" ADD COLUMN "kycDocumentPath" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN "kycDocumentMimeType" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "kycSubmittedAt" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "kycReviewedAt" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "kycRejectionReason" VARCHAR(500);

-- Property ownership verification: no reliable automated land-registry check
-- exists, so this is a document + manual admin review, same pattern as KYC.
ALTER TABLE "properties" ADD COLUMN "verificationStatus" VARCHAR(50) NOT NULL DEFAULT 'unverified';
ALTER TABLE "properties" ADD CONSTRAINT properties_verificationStatus_check
  CHECK ("verificationStatus" IN ('unverified', 'pending_review', 'verified', 'rejected'));
ALTER TABLE "properties" ADD COLUMN "verificationDocumentPath" VARCHAR(500);
ALTER TABLE "properties" ADD COLUMN "verificationDocumentMimeType" VARCHAR(100);
ALTER TABLE "properties" ADD COLUMN "verificationSubmittedAt" TIMESTAMP;
ALTER TABLE "properties" ADD COLUMN "verificationReviewedAt" TIMESTAMP;
ALTER TABLE "properties" ADD COLUMN "verificationRejectionReason" VARCHAR(500);

-- Lets a tenant opt out of the rent reminder emails sent by
-- src/jobs/rentReminderScheduler.ts without disabling transactional emails
-- (payment confirmations, dispute resolutions, etc).
ALTER TABLE "users" ADD COLUMN "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

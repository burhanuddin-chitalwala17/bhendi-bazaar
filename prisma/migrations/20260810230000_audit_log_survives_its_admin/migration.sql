-- Deleting an admin user must never erase the audit trail of what they did —
-- that is the record wanted most when removing one. Flagged in the data-model
-- review's referential-actions table; no application path deletes users, so this
-- only forbids a manual delete from doing silent damage.
ALTER TABLE "AdminLog" DROP CONSTRAINT "AdminLog_adminId_fkey";
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

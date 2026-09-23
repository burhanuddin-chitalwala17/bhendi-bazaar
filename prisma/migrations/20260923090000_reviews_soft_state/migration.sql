-- Reviews stop being deleted, and stop losing their author (ADR-0032).
--
-- Three changes, all on the same principle: a record that carries attribution is
-- retired, never destroyed, and the state that retires it says *which* act did so.

-- 1. `isApproved` becomes `withdrawnAt`. Nothing ever approved a review — it published
--    on write and the platform could take it down — so the boolean was named for a
--    workflow that does not exist. Null is published, a timestamp is withdrawn, and a
--    restore sets it back to null (the shape `Product.archivedAt` already uses).
ALTER TABLE "Review" ADD COLUMN "withdrawnAt" TIMESTAMP(3);
UPDATE "Review" SET "withdrawnAt" = "updatedAt" WHERE "isApproved" = false;
ALTER TABLE "Review" DROP COLUMN "isApproved";

-- 2. The author's own retraction, which is a different act by a different person than
--    the platform's withdrawal and could not share one column with it.
ALTER TABLE "Review" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 3. `userId` becomes required, and its key becomes Restrict. A review is attribution
--    (ADR-0020), and a user is deactivated rather than deleted (ADR-0032), so the
--    nullable column described a state the platform no longer permits — at the cost of
--    an "anonymous voice" branch in the rating arithmetic and an `isMine` guard against
--    `null === null`.
--
--    Refused loudly rather than repaired quietly: rows predating this rule cannot be
--    re-attributed by a migration, and guessing an author is worse than stopping. If
--    this raises, decide per row whether to reassign or remove it, then re-run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Review" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION
      'Cannot make Review.userId required: % row(s) have no author. Resolve them first (ADR-0032).',
      (SELECT count(*) FROM "Review" WHERE "userId" IS NULL);
  END IF;
END
$$;

ALTER TABLE "Review" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. A user is retired, never deleted. Separate from `isBlocked`, which is the platform
--    shutting someone out — different actor, different remedy, and an admin panel that
--    cannot tell a banned account from a closed one cannot act on either.
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- The visible-review predicate tests both state columns together, so the index carries
-- both. Its predecessor led on `isApproved` and was dropped by Postgres along with that
-- column above — an index does not outlive a column it names, so there is deliberately
-- no DROP INDEX here. Adding one fails with 42704 and takes the whole migration with it.
CREATE INDEX "Review_productId_withdrawnAt_deletedAt_createdAt_idx"
  ON "Review"("productId", "withdrawnAt", "deletedAt", "createdAt");

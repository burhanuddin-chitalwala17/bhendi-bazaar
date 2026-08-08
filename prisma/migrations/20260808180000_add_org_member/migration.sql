-- Membership of an org, with the role on the relationship.
--
-- Purely additive: one enum, one table, no existing row is touched. Nothing reads it
-- yet, which is deliberate — it means the authorization change that follows is additive
-- rather than a schema change (see organisations-and-membership trd.md D4).
--
-- No backfill is possible. Existing orgs have no owner to infer: `contactPerson` is a
-- free-text name, not a user reference, so guessing an owner would write a fiction into
-- an authorization table. Orgs start with no members and get them from org-onboarding
-- and org-team.

CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'STAFF');

CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- One membership per person per org, enforced here rather than by a prior read.
CREATE UNIQUE INDEX "OrgMember_userId_orgId_key" ON "OrgMember"("userId", "orgId");
CREATE INDEX "OrgMember_orgId_idx" ON "OrgMember"("orgId");

ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

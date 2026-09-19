-- An org gets a public address and a storefront to put at it (ADR-0030).
--
-- `handle` is NOT NULL and unique, so it is added nullable, backfilled from each org's
-- own name, and only then constrained. Doing it in that order means the constraint is
-- proved against real rows rather than hoped for.

ALTER TABLE "Org" ADD COLUMN "handle" TEXT;

-- Storefront presentation. All nullable: a shop with none of it filled in still has a
-- storefront, which is the point of storefront-pages R7a.
ALTER TABLE "Org" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Org" ADD COLUMN "heroUrl" TEXT;
ALTER TABLE "Org" ADD COLUMN "accent" TEXT;
ALTER TABLE "Org" ADD COLUMN "deliveryPolicy" TEXT;
ALTER TABLE "Org" ADD COLUMN "returnsPolicy" TEXT;

-- Backfill: lower, any run of non-alphanumerics becomes one hyphen, trim the ends.
--
-- Deliberately no `unaccent`: the extension is not guaranteed on a managed Postgres, and
-- a migration that needs one it cannot create fails the deploy. The cost is that an
-- accented letter becomes a separator here where TypeScript's `slugify` would fold it to
-- its base letter — "Café" backfills as "caf" rather than "cafe". That is a handle the
-- owner can change, which is the whole reason handles are changeable; a failed deploy is
-- not. A name that reduces to nothing falls back to the org code, always present and
-- always safe. Collisions take -2, -3, … by creation order, so the oldest org keeps the
-- bare handle.
WITH slugged AS (
  SELECT
    "id",
    COALESCE(
      NULLIF(
        trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      lower("code")
    ) AS base,
    "createdAt"
  FROM "Org"
), numbered AS (
  SELECT "id", base,
         ROW_NUMBER() OVER (PARTITION BY base ORDER BY "createdAt", "id") AS n
  FROM slugged
)
UPDATE "Org" o
SET "handle" = CASE WHEN nu.n = 1 THEN nu.base ELSE nu.base || '-' || nu.n END
FROM numbered nu
WHERE o."id" = nu."id";

ALTER TABLE "Org" ALTER COLUMN "handle" SET NOT NULL;
CREATE UNIQUE INDEX "Org_handle_key" ON "Org"("handle");
CREATE INDEX "Org_handle_idx" ON "Org"("handle");

-- A handle this org used to hold. Rows are never deleted at expiry: the hold is derived
-- from `retiredAt` against the window, so no job has to have run for a read to be right.
CREATE TABLE "OrgHandleHistory" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgHandleHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrgHandleHistory_handle_retiredAt_idx" ON "OrgHandleHistory"("handle", "retiredAt");
CREATE INDEX "OrgHandleHistory_orgId_idx" ON "OrgHandleHistory"("orgId");
ALTER TABLE "OrgHandleHistory" ADD CONSTRAINT "OrgHandleHistory_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An org's own storefront banners. A separate table from "Banner" on purpose: the rule
-- that these never reach the platform home page is then structural, not a filter.
CREATE TABLE "OrgBanner" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "href" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgBanner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrgBanner_orgId_isActive_order_idx" ON "OrgBanner"("orgId", "isActive", "order");
ALTER TABLE "OrgBanner" ADD CONSTRAINT "OrgBanner_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

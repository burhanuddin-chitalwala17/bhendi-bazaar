-- `User.role` becomes `User.platformRole`, typed.
--
-- A rename in place: the column, its values and every row survive, and nobody's access
-- changes. Once `OrgMember.role` exists an unqualified `role` means two different things,
-- which is how `ProductFlag` came to be declared three times.
--
-- The type also tightens from `String` to an enum, so the database rejects a value that
-- is neither. The cast below FAILS LOUDLY if any existing row holds something other than
-- 'USER' or 'ADMIN' — which is the desired behaviour: a silent default would invent a
-- permission level. Check before applying:
--   SELECT DISTINCT "role" FROM "User";

CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User" RENAME COLUMN "role" TO "platformRole";

-- The default has to go before the type changes, and come back after, because it is a
-- text literal that no longer typechecks against the enum mid-flight.
ALTER TABLE "User" ALTER COLUMN "platformRole" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "platformRole" TYPE "PlatformRole"
  USING "platformRole"::"PlatformRole";
ALTER TABLE "User" ALTER COLUMN "platformRole" SET DEFAULT 'USER';

ALTER INDEX "User_role_idx" RENAME TO "User_platformRole_idx";

/**
 * Bootstrap the first platform administrator, in an environment that has none.
 *
 * Not a seed in the sense `prisma/seed.ts` is: it deletes nothing, it is idempotent, and
 * it is the one script here that may legitimately be pointed at production — which is
 * exactly why it carries no fixture data and no literals.
 *
 * **The credential comes from the environment and is never written down.** This file used
 * to hash the string `'STRONG_RANDOM_PASSWORD'` — a placeholder that reads as advice but
 * behaves as a password, so running it granted ADMIN to anyone who had read the repository.
 * CLAUDE.md Invariant 7 says it plainly: no credential literal lives in a seed.
 *
 * It also used to create the Shiprocket provider row. That is reference data and ships as
 * the `register_shiprocket_provider` data migration, which `vercel.json` applies on every
 * deploy — so doing it here was a second writer for a row that already arrives on its own.
 *
 * Run it once per environment:
 *
 *   PROD_ADMIN_EMAIL=… PROD_ADMIN_PASSWORD=… \
 *     npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' \
 *     prisma/seed/prod.ts
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

/** Values that look like instructions rather than secrets, and have been used as both. */
const PLACEHOLDERS = new Set([
  "STRONG_RANDOM_PASSWORD",
  "CHANGE_ME",
  "CHANGEME",
  "PASSWORD",
  "ADMIN",
  "ADMIN@123",
]);

function credential(name: string, minimum = 1): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. This script grants platform ADMIN, so the credential is ` +
        `supplied by the environment rather than stored in the repository.`,
    );
  }
  if (PLACEHOLDERS.has(value.toUpperCase())) {
    throw new Error(`${name} is a placeholder, not a secret. Choose a real value.`);
  }
  if (value.length < minimum) {
    throw new Error(`${name} must be at least ${minimum} characters.`);
  }
  return value;
}

async function main() {
  const email = credential("PROD_ADMIN_EMAIL").toLowerCase();
  const password = credential("PROD_ADMIN_PASSWORD", 12);

  // Idempotent, and deliberately does **not** reset the password of an account that
  // already exists: re-running a bootstrap script must not be a way to take over an
  // administrator's login. Promoting an existing user is the one thing it will do.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, platformRole: true },
  });

  if (existing) {
    if (existing.platformRole === "ADMIN") {
      console.log(`✓ ${email} is already a platform admin. Nothing to do.`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { platformRole: "ADMIN", isEmailVerified: true },
    });
    console.log(`✓ Promoted the existing account ${email} to platform admin.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash: await hash(password, 10),
      platformRole: "ADMIN",
      isEmailVerified: true,
      profile: { create: {} },
    },
  });
  console.log(`✓ Created platform admin ${email}.`);
}

main()
  .catch((error) => {
    console.error("❌ Could not bootstrap the admin:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

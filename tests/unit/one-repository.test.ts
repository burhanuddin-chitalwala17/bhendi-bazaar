// Invariant 5: a table is reached through exactly one repository (ADR-0003). It had no test,
// and on 2026-10-02 nineteen files outside a repository called `prisma.<model>` directly —
// six of them route handlers, one a shipping webhook writing `prisma.order`. A ratchet, for
// the reason in docs/TESTING.md: the list may shrink and never grow.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(relative(ROOT, path));
  }
  return out;
}

const DIRECT_CALL = /\bprisma\.[a-z][A-Za-z]*\.(?:find|create|update|delete|upsert|count|aggregate|groupBy)/;

const WANTS_A_REPOSITORY = "Predates this test. Wants a repository method on the table's owner.";

/** Files that call Prisma directly today, each with why it has not moved. */
const ALLOWED_VIOLATIONS: Record<string, string> = {
  "src/lib/auth-adapter.ts": "NextAuth's Prisma adapter is handed the client by design; its tables are the library's.",
  "src/lib/auth-config.ts": WANTS_A_REPOSITORY,
  "src/lib/admin-auth.ts": "Re-reads the user row on every admin request (ADR-0021). Wants identity's repository.",
  "server/analytics/widgets.ts": "The read-only aggregating domain. Wants its reads behind the owners' repositories.",
  "server/catalog/media-backfill.ts": "A one-off backfill run by script, not by the app.",
  "server/catalog/bulk/bulk-category.service.ts": WANTS_A_REPOSITORY,
  "server/catalog/bulk/bulk-product.service.ts": WANTS_A_REPOSITORY,
  "server/checkout/order.service.ts": WANTS_A_REPOSITORY,
  "server/identity/password.service.ts": WANTS_A_REPOSITORY,
  "server/identity/profile.service.ts": WANTS_A_REPOSITORY,
  "server/notifications/email.service.ts": WANTS_A_REPOSITORY,
  "server/shipping/shipment-status.service.ts": WANTS_A_REPOSITORY,
  "server/wishlist/wishlist.service.ts": WANTS_A_REPOSITORY,
  "src/app/api/admin/shipments/[id]/tracking/route.ts": "A handler doing a service's job. Wants shipping's service.",
  "src/app/api/auth/signup/route.ts": "A handler doing a service's job. Wants identity's service.",
  "src/app/api/checkout/allocate/route.ts": "A handler doing a service's job. Wants checkout's service.",
  "src/app/api/products/check-stock/route.ts": "A handler doing a service's job. Wants catalog's service.",
  "src/app/api/profile/upload-picture/route.ts": "A handler doing a service's job. Wants identity's service.",
  "src/app/api/webhooks/shipping/shiprocket/route.ts":
    "Writes `prisma.order` from a shipping webhook. Wants checkout's service — the most urgent entry here.",
};

describe("one aggregate, one repository (Invariant 5)", () => {
  const files = [...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "server"))].filter(
    (f) => !/\.repository\.ts$/.test(f),
  );
  const offenders = files.filter((f) => DIRECT_CALL.test(readFileSync(f, "utf8")));

  it("scans the source it claims to check", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("no new file reaches Prisma outside a repository", () => {
    expect(
      offenders.filter((f) => !(f in ALLOWED_VIOLATIONS)),
      "Call the table's repository, through its domain's service. A route handler never calls Prisma.",
    ).toEqual([]);
  });

  it("the allowlist only shrinks: a fixed file leaves it", () => {
    expect(Object.keys(ALLOWED_VIOLATIONS).filter((f) => !offenders.includes(f))).toEqual([]);
  });
});

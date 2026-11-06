/**
 * A file's reasons to change are recorded, and gaining one is a decision ([ADR-0036]).
 *
 * This replaces a line-count budget, which measured the wrong thing. The problem was never
 * that `server/checkout/order.service.ts` is long — it is that it reaches into **six other
 * domains**, so six unrelated feature areas each have a reason to edit it. That is why it took
 * 26 commits in three months. A 200-line file with the same reach would be the same problem.
 *
 * The moment of drift is precise and catchable: **it is the import.** When a feature adds
 * `import … from "@server/bidding/…"` to a checkout file, that file has just acquired a new
 * reason to change, and it happens in one line that looks harmless in review. This gate fires
 * exactly there, on every file, at any size.
 *
 * The threshold comes from the tree rather than from taste: 445 files reach no other domain,
 * 168 reach one, 12 reach two, and five reach more. Two is where the codebase already lives.
 *
 * What to do when it fires:
 *   - Does this file's *one* responsibility need the new area? Usually not — the call belongs
 *     in the domain that owns the concept, and this file should ask it a question instead.
 *   - If it genuinely does, record it here with the reason. That is the thought, made visible.
 *
 * Change-coupling, 2026-09-23, for context on what the reach costs: `order.service.ts`,
 * `order.types.ts`, `order.repository.ts`, `order.schemas.ts` and `useCheckoutPayment.ts`
 * change together in 71–100% of the commits that touch any of them.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

/** Above this, a file must name the areas it reaches and why. */
const FREE_REACH = 2;

/**
 * Files that reach further, with the exact set pinned. The set matters more than the count:
 * a recorded file gaining one more domain must still stop and justify it.
 *
 * Only exceptions belong here. A file within the free limit needs no entry even when its reach
 * is interesting — `server/checkout/sale-gates.ts` reaches two by design, and says so in its
 * own header, which is the better home for that.
 */
const RECORDED: Record<string, { domains: string[]; why: string }> = {
  "src/data-access-layer/org/readiness-fix.dal.ts": {
    domains: ["catalog", "channels", "listing"],
    why:
      "A read for one page, where three answers meet by definition (readiness-fix R2, Q6): listing " +
      "says which products a channel would refuse for want of a fact and what may answer it, catalog " +
      "supplies each product's name and photo, and channels the marketplace's own word as evidence. " +
      "A DAL composes reads; no write happens here, so none of the three gains a reason to change.",
  },
  "server/checkout/payment-confirmed.ts": {
    domains: ["identity", "notifications", "payouts"],
    why:
      "Where three domains meet by definition: once the money is real the ledger records what " +
      "each org earned, identity supplies a recipient when the delivery address has none, and " +
      "notifications sends the confirmation. That convergence is the module's whole purpose — " +
      "it exists so those three are not three reasons for `order.service.ts` to change, which " +
      "took that file from eight domains to two. Nothing here may throw: the gateway already " +
      "has the money.",
  },
  "server/checkout/cancel-give-back.ts": {
    domains: ["payments", "payouts", "promotions"],
    why:
      "The money a parcel cancel gives back, as one seam (order-fulfilment D12–D14, D16): the offer " +
      "budget and coupon (promotions), the refund owed (payments) and the shop's fee (payouts). " +
      "Split, a second cancel path could run some give-backs and not others. Narrowed from a " +
      "five-domain `parcel-moved.ts` at review; the owner accepted this entry 2026-11-01 (decisions Q37).",
  },
  "server/payouts/ledger.service.ts": {
    domains: ["catalog", "checkout", "promotions"],
    why:
      "Settlement is inherently the cross-domain sum: what was ordered (checkout), the category " +
      "and commercial terms that set the rate (catalog), and the promotion behind an attribution " +
      "(promotions). `checkout` is new here and is an improvement — it replaced `ledger.repository` " +
      "reaching into `checkout/order.repository`, which was the same coupling one layer lower and " +
      "past the service that owns the rules. The durable fix is for checkout to *push* a settlement " +
      "view rather than payouts pulling four ways, which is an events change, not a rename.",
  },
  "src/domain/admin.ts": {
    domains: ["analytics", "cart", "catalog", "checkout", "identity"],
    why:
      "A barrel of admin-console DTOs, so it re-exports a shape from every domain the console " +
      "shows. It holds no logic, which is why the reach is harmless here — but it is also why " +
      "each of those shapes would be better imported from its own domain at the call site.",
  },
  "src/data-access-layer/org/home.dal.ts": {
    domains: ["analytics", "catalog", "channels", "content"],
    why:
      "Home's one job is to ask each area whether it needs the shop (own-store onboarding D7): parcels " +
      "to pack and selling low stock from analytics, setup and team edits from catalog, a connection from " +
      "channels, photo proposals from content. Each is one service call that fails alone.",
  },
  "src/data-access-layer/products.dal.ts": {
    domains: ["bidding", "catalog", "promotions"],
    why:
      "A product as a buyer sees it is a catalog row plus an effective price (ADR-0018) plus a " +
      "bidding suspension (ADR-0023). Both extra reaches are mandated seams, not shortcuts.",
  },
  "src/data-access-layer/admin/products.dal.ts": {
    domains: ["catalog", "listing", "promotions", "wishlist"],
    why: "The admin product list: catalogue products, listing type resolution for the form, promotions for the effective price (ADR-0018). Each a service call.",
  },
  "src/app/api/checkout/promotions/quote/route.ts": {
    domains: ["catalog", "checkout", "promotions"],
    why:
      "Quotes a basket's discount before checkout: it needs the catalogue's prices, the " +
      "promotion engine and checkout's totals. A thin handler over three services rather than " +
      "logic of its own.",
  },
  "server/catalog/admin.product.service.ts": {
    domains: ["bidding", "listing", "promotions"],
    why: "The catalogue admin reads: bidding lock for an auctioned product, listing's type resolution for the form, promotions for offer targeting. Each is a single call to that domain's public surface.",
  },
};

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        if (entry !== "node_modules" && entry !== "migrations") walk(p);
      } else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.endsWith(".d.ts")) {
        out.push(p);
      }
    }
  };
  ["src", "server", "prisma"].forEach((d) => walk(join(ROOT, d)));
  return out;
}

/**
 * The other domains a file reaches into. Its own domain is not a reason to change, and
 * `shared` is the kernel every domain may use (ADR-0033 D4).
 */
function reach(file: string): string[] {
  const rel = relative(ROOT, file);
  const own = rel.startsWith("server/") ? rel.split("/")[1] : null;
  const found = new Set<string>();
  // Static `from "@server/x"` AND dynamic `import("@server/x")`. A deferred import is still a
  // reason to change — it was invisible here until 2026-09-24, which hid two of
  // `order.service.ts`'s six domains behind `await import(...)`.
  const source = readFileSync(file, "utf8");
  for (const m of source.matchAll(/(?:from\s*"|import\(\s*")@server\/([a-z-]+)/g)) {
    const domain = m[1];
    if (domain !== own && domain !== "shared") found.add(domain);
  }
  return [...found].sort();
}

const reaches = new Map(sourceFiles().map((f) => [relative(ROOT, f), reach(f)]));

describe("a file's reasons to change are a decision, not a drift", () => {
  it("the scan reaches the tree it claims to measure", () => {
    expect(reaches.size).toBeGreaterThan(300);
    expect([...reaches.values()].filter((r) => r.length > 0).length).toBeGreaterThan(50);
  });

  it(`no file reaches more than ${FREE_REACH} other domains without saying why`, () => {
    const offenders = [...reaches.entries()]
      .filter(([f, r]) => r.length > FREE_REACH && !(f in RECORDED))
      .map(([f, r]) => `${f} -> ${r.join(", ")}`);

    expect(
      offenders,
      "This file now has more reasons to change than the codebase allows without a decision. " +
        "Ask whether its one responsibility needs the new area — usually the call belongs in the " +
        "domain that owns the concept, and this file should ask it a question instead. If it " +
        "genuinely belongs, record it in RECORDED with the reason:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("a recorded file has not quietly gained another domain", () => {
    // The set is pinned, not just the count: already being coupled is not licence to couple more.
    const widened: string[] = [];
    for (const [file, { domains }] of Object.entries(RECORDED)) {
      const now = reaches.get(file);
      if (!now) continue;
      const added = now.filter((d) => !domains.includes(d));
      if (added.length) widened.push(`${file} gained: ${added.join(", ")}`);
    }
    expect(
      widened,
      "A file that is already coupled may not become more so without the same decision:\n" +
        widened.map((w) => `    ${w}`).join("\n"),
    ).toEqual([]);
  });

  it("a recorded set that has shrunk is narrowed here", () => {
    const stale: string[] = [];
    for (const [file, { domains }] of Object.entries(RECORDED)) {
      const now = reaches.get(file);
      if (!now) { stale.push(`${file} no longer exists`); continue; }
      const gone = domains.filter((d) => !now.includes(d));
      if (gone.length) stale.push(`${file} no longer reaches: ${gone.join(", ")}`);
    }
    expect(
      stale,
      "Decoupled — narrow the record so the ratchet tightens:\n" + stale.map((s) => `    ${s}`).join("\n"),
    ).toEqual([]);
  });

  it("every recorded file explains itself", () => {
    const vague = Object.entries(RECORDED).filter(([, v]) => v.why.trim().length < 60);
    expect(
      vague.map(([f]) => f),
      "The reason is the entire point of the record. A sentence that could describe any file is not one.",
    ).toEqual([]);
  });
});

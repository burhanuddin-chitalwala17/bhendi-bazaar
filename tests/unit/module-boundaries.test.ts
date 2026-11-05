/**
 * Domain boundaries and layering, enforced rather than described ([ADR-0033]).
 *
 * "A domain calls another domain's public surface, never its internals" has been in
 * CLAUDE.md since ADR-0012 and was never checked. Thirteen cross-domain repository imports
 * accumulated under it. The rule was unfollowable as written, because nothing said what a
 * *surface* was: `catalog/product.visibility` is meant to be shared (ADR-0029 requires every
 * buyer-facing read to spread it) while `catalog/product.repository` is not, and both are
 * just a file in a directory.
 *
 * So the surface is declared below, as data. Everything else in a domain is internal.
 *
 * **These are ratchets.** Existing violations are allowlisted with the reason each survives;
 * the lists may shrink and never grow. A gate that fails on day one with thirteen errors gets
 * suppressed instead of fixed — docs/TESTING.md records that happening to lint in this repo.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SERVER = join(ROOT, "server");

/**
 * What each domain answers to the rest of the application. A module not listed here is
 * internal — callable within its own domain, nowhere else.
 *
 * Entries are matched as prefixes against the path after `@server/<domain>/`, so
 * `"product.visibility"` covers exactly that module.
 */
const PUBLIC_SURFACE: Record<string, string[]> = {
  // Services and types are public everywhere; these are the extra seams a domain declares.
  catalog: [
    // ADR-0029 / ADR-0030: one `where` fragment every buyer-facing read spreads.
    "product.visibility",
    // The assertions the order transaction must run — the enforcement point, by design.
    "product.sale-gate",
    "org.sale-gate",
    "product.flags",
    "object-store",
    "media",
    "org.handle",
    "image-upload",
    // media-library D4: the editor and the server resolve a category's slots with one function,
    // and enhancement refuses the label slot by the same role constant (image-enhancement R5).
    "shot-list",
    // listing-fill reads brand defaults and category trees to fill a product's blanks.
    "brand.repository",
    "category.read.repository",
  ],
  listing: [
    // ADR-0051/0052: the vocabulary, types and readiness are listing's public answers.
    "product-type",
    "product-type.types",
    "listing-facts",
    "size-label",
    "fill-facts",
    "listing-fill.service",
    "listing-value.repository",
    "channel-readiness",
    "channel-readiness.service",
    "channel-register.service",
    "channel-map.repository",
    "org-channel.service",
    "org-listing-defaults.service",
    "org-listing-defaults.types",
    "product-family.service",
    "fact-correction.service",
    "admin.product-type.service",
    "admin.product-type.types",
    "product-readiness.repository",
    "org-channel.repository",
  ],
  promotions: [
    // ADR-0018: every surface that needs a price calls this resolver.
    "price-context",
    "targeting",
    "allocation",
  ],
  bidding: [
    // ADR-0023: suspension is re-checked inside the order transaction through this.
    "bidding-lock",
    "bidding-window",
  ],
  checkout: ["pricing", "allocation", "order-code"],
  notifications: ["templates"],
  shipping: ["billable-weight", "providers"],
  identity: [],
  cart: [],
  payments: ["notes", "confirmation"],
  payouts: ["commission"],
  analytics: [],
  wishlist: [],
  content: [],
  // channel-connectors D1: the connection service and its types only. Tokens never leave.
  channels: [],
  // setup-requests D1: its service and types only; the repository and kinds stay inside.
  requests: [],
};

/** Always public, in every domain. */
const ALWAYS_PUBLIC = [".service", ".types", "index"];

/**
 * Cross-domain imports that break the rule and have not been fixed yet. Each is real
 * coupling; the reason records why it survives, so the list reads as a backlog rather than
 * as permission.
 */
const ALLOWED_VIOLATIONS: Record<string, string> = {
  "payments/payment.service.ts -> checkout/order.repository":
    "The paid transition is a conditional write that must stay one statement (ADR-0005, ADR-0007). Routing it through a service method would either leak the condition or add a read-then-write. Needs checkout to expose a `confirmPaid` command.",
};

interface Import {
  from: string;
  fromDomain: string;
  toDomain: string;
  module: string;
  typeOnly: boolean;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && !p.endsWith(".d.ts")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const DOMAINS = readdirSync(SERVER).filter((d) => statSync(join(SERVER, d)).isDirectory());

function crossDomainImports(): Import[] {
  const out: Import[] = [];
  for (const domain of DOMAINS) {
    for (const file of sourceFiles(join(SERVER, domain))) {
      const text = readFileSync(file, "utf8");
      // Static imports, and `await import("@server/x/y")`, which evaded this until
      // 2026-09-24 and was hiding a cross-domain repository call.
      const re = /import\s+(type\s+)?[^"']*?from\s+"@server\/([a-z-]+)\/([^"]+)"|import\(\s*"@server\/([a-z-]+)\/([^"]+)"/g;
      for (const m of text.matchAll(re)) {
        const typeOnly = m[1];
        const toDomain = m[2] ?? m[4];
        const module = m[3] ?? m[5];
        // `shared` is the shared kernel, and a domain importing itself is not crossing.
        if (toDomain === domain || toDomain === "shared") continue;
        out.push({
          from: relative(ROOT, file),
          fromDomain: domain,
          toDomain,
          module,
          typeOnly: Boolean(typeOnly),
        });
      }
    }
  }
  return out;
}

const isPublic = (toDomain: string, module: string) =>
  ALWAYS_PUBLIC.some((s) => module.includes(s)) ||
  (PUBLIC_SURFACE[toDomain] ?? []).some((s) => module === s || module.startsWith(`${s}/`) || module.startsWith(`${s}.`));

describe("a domain is reached through its declared public surface", () => {
  const imports = crossDomainImports();

  it("finds cross-domain imports to check (the scan itself works)", () => {
    // A regex that silently matches nothing would make every assertion below vacuous.
    expect(imports.length).toBeGreaterThan(10);
  });

  it("every domain under server/ has a declared surface", () => {
    const undeclared = DOMAINS.filter((d) => d !== "shared" && !(d in PUBLIC_SURFACE));
    expect(
      undeclared,
      "A new domain must declare what it answers to the rest of the app — an empty array is a " +
        "fine answer and means 'services and types only':\n" + undeclared.map((d) => `    ${d}`).join("\n"),
    ).toEqual([]);
  });

  it("no domain reaches past another's surface", () => {
    const offenders = imports
      .filter((i) => !i.typeOnly && !isPublic(i.toDomain, i.module))
      .map((i) => `${i.fromDomain}/${i.from.split("/").pop()} -> ${i.toDomain}/${i.module}`)
      .filter((key) => !(key in ALLOWED_VIOLATIONS));

    expect(
      [...new Set(offenders)],
      "These reach into another domain's internals. Either call that domain's service, or — if " +
        "the module is genuinely a shared contract — add it to PUBLIC_SURFACE, which is a " +
        "deliberate statement that other domains may depend on it:\n" +
        [...new Set(offenders)].map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("the allowlist only shrinks", () => {
    // An entry that no longer describes a real import has been fixed; delete it, so the list
    // cannot quietly become a place where rules go to be forgotten.
    const live = new Set(
      imports
        .filter((i) => !i.typeOnly && !isPublic(i.toDomain, i.module))
        .map((i) => `${i.fromDomain}/${i.from.split("/").pop()} -> ${i.toDomain}/${i.module}`),
    );
    const stale = Object.keys(ALLOWED_VIOLATIONS).filter((k) => !live.has(k));
    expect(
      stale,
      "Fixed — remove these from ALLOWED_VIOLATIONS so the ratchet tightens:\n" +
        stale.map((s) => `    ${s}`).join("\n"),
    ).toEqual([]);
  });

  it("every allowlisted violation says why it survives", () => {
    const vague = Object.entries(ALLOWED_VIOLATIONS).filter(([, why]) => why.trim().length < 40);
    expect(vague.map(([k]) => k), "A reason short enough to be a shrug is not a reason.").toEqual([]);
  });
});

describe("layers do not reach past each other", () => {
  const appFiles = sourceFiles(join(ROOT, "src/app"));
  const componentFiles = sourceFiles(join(ROOT, "src/components"));
  const routeOrPage = (f: string) => /\/(page|layout)\.tsx$/.test(f);

  it("the scan reaches the files it claims to check", () => {
    // `sourceFiles` collected only `.ts` at first, so src/app matched nothing and the two
    // assertions below passed while checking zero files. A scan-based gate has to prove it
    // scanned something.
    expect(appFiles.filter(routeOrPage).length, "no pages found under src/app").toBeGreaterThan(20);
    expect(componentFiles.length, "no components found").toBeGreaterThan(50);
  });

  /** Pages read through the data-access layer; these predate it. */
  const PAGES_USING_REPOSITORIES: Record<string, string> = {
    "src/app/(org)/org/page.tsx": "Lists the caller's orgs. Wants a DAL read.",
    "src/app/(org)/org/[orgId]/layout.tsx": "Resolves the org for the portal chrome. Wants a DAL read.",
    "src/app/(org)/org/[orgId]/promotions/new/page.tsx": "Loads targetable products. Wants a DAL read.",
    "src/app/(org)/org/[orgId]/promotions/[id]/edit/page.tsx": "Same as new/page.tsx.",
    "src/app/(admin)/admin/banners/[id]/edit/page.tsx": "Loads one banner. Wants a DAL read.",
    "src/app/(admin)/admin/promotions/new/page.tsx": "Loads targetable products and orgs. Wants a DAL read.",
    "src/app/(admin)/admin/promotions/[id]/edit/page.tsx": "Same as new/page.tsx.",
  };

  it("a component never imports Prisma or a repository", () => {
    // Components know nothing about Prisma; repositories know nothing about HTTP.
    // Type-only imports count here, unlike between server domains (ADR-0033 D5): a component
    // typed by a row renders the row's shape and is handed every column of it.
    const offenders = componentFiles.filter((f) =>
      /from\s+"(@prisma\/client|@server\/shared\/prisma|@server\/[a-z-]+\/[^"]*repository)"/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect([...new Set(offenders.map((f) => relative(ROOT, f)))]).toEqual([]);
  });

  it("a page reads through the data-access layer, not a repository", () => {
    const offenders = appFiles
      .filter(routeOrPage)
      .filter((f) => /from "@server\/[a-z-]+\/[^"]*repository"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f))
      .filter((f) => !(f in PAGES_USING_REPOSITORIES));

    expect(
      offenders,
      "A page reaching a repository skips `src/data-access-layer/`, which exists to keep pages " +
        "out of Prisma. Add a DAL read instead:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("the page allowlist only shrinks", () => {
    const live = new Set(
      appFiles
        .filter(routeOrPage)
        .filter((f) => /from "@server\/[a-z-]+\/[^"]*repository"/.test(readFileSync(f, "utf8")))
        .map((f) => relative(ROOT, f)),
    );
    const stale = Object.keys(PAGES_USING_REPOSITORIES).filter((k) => !live.has(k));
    expect(stale, "Converted — remove from the allowlist:\n" + stale.join("\n")).toEqual([]);
  });

  it("server/ never imports from src/, except as a type", () => {
    // Dependency direction is inward. A value import would make the server depend on the UI.
    const offenders: string[] = [];
    for (const file of sourceFiles(SERVER)) {
      for (const m of readFileSync(file, "utf8").matchAll(/import\s+(type\s+)?[^"']*?from\s+"(@\/[^"]+)"/g)) {
        if (!m[1]) offenders.push(`${relative(ROOT, file)} -> ${m[2]}`);
      }
    }
    expect(
      offenders,
      "`server/` must not import from `src/` (CLAUDE.md, Development Principles). A shared " +
        "shape belongs in a neutral module:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });
});

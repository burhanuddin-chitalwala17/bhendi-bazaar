// Hints and "?" (seller-onboarding R4, R5, A5; D9). A hint the seller cannot finish in a glance is
// a tour by another name, and a page without "?" is a page that cannot say what it is for.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ONBOARDING_STEP, ONBOARDING_STEPS } from "@server/catalog/org-onboarding.types";
import { PORTAL_NAV } from "@/components/layout/portal-nav";
import { PAGE_HINT_CARDS, STEP_HINT, pageHelp } from "@/components/layout/portal-hints";

const ORG_ROOT = "src/app/(org)/org/[orgId]";
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;

const allHints = [
  ...ONBOARDING_STEPS.flatMap((step) => (STEP_HINT[step] ? [{ id: `step ${step}`, cards: STEP_HINT[step]!.cards }] : [])),
  ...Object.entries(PAGE_HINT_CARDS).map(([key, cards]) => ({ id: `page ${key}`, cards: cards ?? [] })),
];

describe("hints (R4, A5)", () => {
  it("every step a seller can still do opens a hint (R4)", () => {
    for (const step of ONBOARDING_STEPS) {
      if (step === ONBOARDING_STEP.OPEN) continue; // ticked at creation, never a task
      expect(STEP_HINT[step], step).not.toBeNull();
    }
  });

  it("has one to three cards, each at most two sentences (own-store Q12)", () => {
    expect(allHints.length).toBeGreaterThan(4);
    for (const { id, cards } of allHints) {
      expect(cards.length, id).toBeGreaterThanOrEqual(1);
      expect(cards.length, id).toBeLessThanOrEqual(3);
      for (const card of cards) expect(sentences(card), `${id}: ${card}`).toBeLessThanOrEqual(2);
    }
  });

  it("keys page cards by a navigation item, so none is orphaned", () => {
    const keys = new Set<string>(PORTAL_NAV.map((entry) => entry.key));
    for (const key of Object.keys(PAGE_HINT_CARDS)) expect(keys.has(key), key).toBe(true);
  });
});

describe('"?" on every page (R5)', () => {
  const pageEntries = PORTAL_NAV.filter((entry) => "page" in entry.target && !entry.target.page.startsWith("#"));

  it("finds the pages it guards", () => {
    expect(pageEntries.length).toBeGreaterThan(10);
  });

  it("each navigation page's header carries its own help key", () => {
    const missing = pageEntries.filter((entry) => {
      const page = "page" in entry.target ? entry.target.page : "";
      const file = page ? `${ORG_ROOT}/${page}/page.tsx` : `${ORG_ROOT}/page.tsx`;
      return !readFileSync(file, "utf8").includes(`help="${entry.key}"`);
    });
    expect(missing.map((entry) => entry.key)).toEqual([]);
  });

  // Sub-pages (a form, an order, a channel's listings) take their section's key; a header inside a
  // shared component gets it as a prop, so the page file still names it.
  const allPages = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
      item.isDirectory() ? allPages(join(dir, item.name)) : item.name === "page.tsx" ? [join(dir, item.name)] : [],
    );

  it("every portal page, sub-pages too, names a help key", () => {
    const pages = allPages(ORG_ROOT);
    expect(pages.length).toBeGreaterThan(20);
    const keys = PORTAL_NAV.map((entry) => entry.key).join("|");
    const named = new RegExp(`help="(${keys})"`);
    expect(pages.filter((file) => !named.test(readFileSync(file, "utf8")))).toEqual([]);
  });

  it("answers with the purpose line the navigation shows", () => {
    for (const entry of pageEntries) {
      expect(pageHelp(entry.key)?.purpose).toBe(entry.purpose);
      expect(pageHelp(entry.key)?.title).toBe(entry.label);
    }
    expect(pageHelp("no-such-page")).toBeNull();
  });
});

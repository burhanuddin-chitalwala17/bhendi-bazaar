/**
 * The shop's notice of the team's edits (product-form R12, A7, D13; ux.md "Shop product notice and
 * history"): the badge and history wording, money as rupees from paise, no admin identity on the
 * wire, a malformed entry left out rather than failing the page, newest five then "Show all
 * changes", a failed read with its own retry, and Home's line.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { toTeamEdits, PRODUCT_TEAM_ACTION, type ProductTeamEditDto } from "@server/catalog/product-team";
import type { HomeAttentionDto } from "@/data-access-layer/org/home.dal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { TEAM_EDIT_COPY, historyLine, changeText } = await import("@/components/product/team/team-edit-copy");
const { TeamHistory } = await import("@/components/product/team/team-history");
const { TeamEditBadge } = await import("@/components/product/team/team-edit-badge");
const { attentionLines } = await import("@/components/org/home/attention-lines");

// 30 Oct, 4:12 pm in Kolkata.
const at = new Date("2026-10-30T10:42:00Z");
const metadata = { orgId: "o1", reason: "Shop asked to fix the price", changes: [{ field: "price", before: 249_900, after: 229_900 }] };
const entry = (over: Partial<{ id: string; action: string; metadata: unknown }> = {}) => ({
  id: "log-1",
  action: PRODUCT_TEAM_ACTION.UPDATED,
  metadata,
  createdAt: at,
  ...over,
});
const edit = (id: string, over: Partial<ProductTeamEditDto> = {}): ProductTeamEditDto => ({
  id,
  at,
  created: false,
  reason: "Shop asked to fix the price",
  changes: metadata.changes,
  ...over,
});

describe("the team's history as the shop reads it", () => {
  it("words a save as the ux's line (Success)", () => {
    expect(historyLine(edit("e1"))).toBe("Bhendi Bazaar team · 30 Oct, 4:12 pm · Price ₹2,499 → ₹2,299 · 'Shop asked to fix the price'");
  });

  it("names a stock row by its location, and an id only as changed", () => {
    expect(changeText({ field: "stock", at: "Main shelf (addr-1)", before: 5, after: 3 })).toBe("Stock at Main shelf 5 → 3");
    expect(changeText({ field: "familyId", before: "fam-1", after: null })).toBe("Family changed");
    expect(changeText({ field: "facts", at: "sleeveLength", before: null, after: "full" })).toBe("Sleeve length — → full");
  });

  it("says a team create as added, not as every field", () => {
    expect(historyLine(edit("e1", { created: true }))).toBe("Bhendi Bazaar team · 30 Oct, 4:12 pm · Added this product · 'Shop asked to fix the price'");
  });

  it("carries no admin identity, and leaves out what does not parse or is another shop's", () => {
    const edits = toTeamEdits(
      [
        entry({ metadata: { ...metadata, adminName: "Asma Admin" } }),
        entry({ id: "log-2", metadata: { name: "an archive entry" } }),
        entry({ id: "log-3", metadata: { ...metadata, orgId: "o2" } }),
        entry({ id: "log-4", action: PRODUCT_TEAM_ACTION.CREATED }),
      ],
      "o1",
    );
    expect(edits.map((e) => [e.id, e.created])).toEqual([["log-1", false], ["log-4", true]]);
    expect(Object.keys(edits[0]).sort()).toEqual(["at", "changes", "created", "id", "reason"]);
    expect(JSON.stringify(edits)).not.toContain("Asma");
  });
});

describe("the badge (First use)", () => {
  it("reads 'Edited by Bhendi Bazaar team · 30 Oct' and opens the history", () => {
    render(<TeamEditBadge at={at} historyHref="#team-history" />);
    expect(screen.getByText("Edited by Bhendi Bazaar team · 30 Oct")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See what changed" }).getAttribute("href")).toBe("#team-history");
  });
});

describe("the history section", () => {
  it("renders nothing without team edits (Empty)", () => {
    const { container } = render(<TeamHistory read={{ ok: true, edits: [] }} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the newest five, then every one on 'Show all changes' (Many items)", () => {
    const edits = Array.from({ length: 7 }, (_, i) => edit(`e${i}`, { reason: `Fix ${i}` }));
    render(<TeamHistory read={{ ok: true, edits }} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: TEAM_EDIT_COPY.showAll }));
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: TEAM_EDIT_COPY.showAll })).toBeNull();
  });

  it("clamps a long line behind 'More' (Long content)", () => {
    const long = edit("e1", { changes: [{ field: "description", before: "a".repeat(120), after: "b".repeat(120) }] });
    render(<TeamHistory read={{ ok: true, edits: [long] }} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("keeps a failed read with its retry (Retryable error)", () => {
    render(<TeamHistory read={{ ok: false }} />);
    expect(screen.getByText("Couldn't load the history.")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry.hasAttribute("disabled")).toBe(false);
  });
});

describe("Home's line (Q23)", () => {
  const quiet = (teamEdits: HomeAttentionDto["teamEdits"]): HomeAttentionDto => ({
    parcels: { ok: true, value: 0 },
    reviews: { ok: true, value: { count: 0, productId: null } },
    channel: { ok: true, value: null },
    photos: { ok: true, value: 0 },
    auction: { ok: true, value: null },
    teamEdits,
  });
  const now = new Date("2026-11-01T10:00:00Z");

  it("opens the one product's history, or the products list for several, and hides at zero", () => {
    expect(attentionLines("o1", quiet({ ok: true, value: { count: 1, productId: "p1" } }), now)[0]).toMatchObject({
      text: "Our team changed 1 product",
      href: "/org/o1/products/p1#team-history",
    });
    expect(attentionLines("o1", quiet({ ok: true, value: { count: 3, productId: null } }), now)[0]).toMatchObject({
      text: "Our team changed 3 products",
      href: "/org/o1/products",
    });
    expect(attentionLines("o1", quiet({ ok: true, value: { count: 0, productId: null } }), now)).toEqual([]);
    expect(attentionLines("o1", quiet({ ok: false }), now)[0]).toMatchObject({ key: "teamEdits", ok: false });
  });
});

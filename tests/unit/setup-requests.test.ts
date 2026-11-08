/**
 * setup-requests: which complaints become tickets (D5, marketplace-publish Q24), how a marketplace
 * field is matched to our vocabulary (D6, Q32), each kind's fingerprint (D3), and the line between the
 * shop's view and the admin's (D11). Pure; the engine's writes are in tests/integration.
 */
import { describe, expect, it } from "vitest";

import { needsFrom } from "@server/requests/marketplace/complaint-sort";
import { planHash, propose, valueKey } from "@server/requests/marketplace/field-match";
import { kindOf } from "@server/requests/kinds";
import { ISSUE_KIND } from "@server/requests/kinds/issue.kind";
import { FIELD_SOLUTION, MARKETPLACE_KIND } from "@server/requests/marketplace/marketplace.types";
import type { AdminRequirementDTO, ShopTicketDTO } from "@server/requests/request.types";
import { channelSetupService } from "@server/listing/channel-setup.service";

const issue = (attribute: string | null, extra: { field?: string; need?: string; code?: string } = {}) => ({
  code: extra.code ?? "90220",
  attribute,
  message: `'${attribute}' is required but missing.`,
  field: extra.field ?? null,
  need: extra.need ?? null,
});

describe("which complaints become tickets (setup-requests D5)", () => {
  const complaint = (issues: ReturnType<typeof issue>[], theirCategory: string | null = "TOTE_BAG") => ({ orgId: "o1", productId: "p1", channel: "amazon", theirCategory, issues });
  const answered = () => new Set(["outer_material"]);

  it("raises one fields ticket for every attribute nobody answers, and nothing for the shop's own fixes", () => {
    const needs = needsFrom(
      [complaint([issue("strap_type"), issue("style"), issue("brand", { need: "brand" }), issue("item_name", { field: "title" }), issue("outer_material")])],
      answered,
    );
    expect(needs).toEqual([
      { orgId: "o1", productId: "p1", subject: { kind: MARKETPLACE_KIND.FIELDS, channel: "amazon", theirCategory: "TOTE_BAG", attributes: ["strap_type", "style"] }, detail: null },
    ]);
  });

  it("makes a complaint naming no attribute an issue for a developer (Q18, Q21)", () => {
    const [need] = needsFrom([complaint([issue(null, { code: "8541" })])], answered);
    expect(need.subject).toMatchObject({ kind: ISSUE_KIND, source: "Amazon", context: "TOTE_BAG", subjectName: null, code: "8541" });
  });

  it("makes an attribute with no marketplace type to set it against an issue, never a fields ticket", () => {
    const [need] = needsFrom([complaint([issue("strap_type")], null)], answered);
    expect(need.subject.kind).toBe(ISSUE_KIND);
  });
});

describe("matching a marketplace field to our vocabulary (D6, Q32)", () => {
  const material = { key: "material", label: "Material", answers: ["Cotton", "Jute"] };
  const strap = { key: "strap", label: "Strap", answers: ["Detachable", "Fixed"] };
  const colour = { key: "colour", label: "Colour", answers: ["Black"] };

  it("reuses a fact the type asks when the names agree", () => {
    expect(propose({ name: "outer_material_type", label: "Outer Material", allowed: [] }, [material, colour], [])).toMatchObject({ solution: FIELD_SOLUTION.REUSE, fact: "material" });
  });

  it("adds a declared fact the type doesn't ask yet, rather than inventing one", () => {
    expect(propose({ name: "strap_type", label: "Strap Type", allowed: ["Detachable"] }, [material], [material, strap])).toMatchObject({ solution: FIELD_SOLUTION.ADD, fact: "strap" });
  });

  it("fills a part or model number from the product itself", () => {
    expect(propose({ name: "part_number", label: "Part Number", allowed: [] }, [], [])).toMatchObject({ solution: FIELD_SOLUTION.FROM_PRODUCT, source: "sku" });
    expect(propose({ name: "model_name", label: "Model Name", allowed: [] }, [], [])).toMatchObject({ solution: FIELD_SOLUTION.FROM_PRODUCT, source: "name" });
  });

  it("fixes an attribute Amazon allows only one answer for, and leaves the rest for a developer", () => {
    expect(propose({ name: "age_range_description", label: "Age Range", allowed: ["Adult"] }, [], [])).toMatchObject({ solution: FIELD_SOLUTION.FIXED, constant: "Adult" });
    expect(propose({ name: "pocket_count", label: "Pockets", allowed: [] }, [material], [material])).toMatchObject({ solution: FIELD_SOLUTION.NOT_POSSIBLE });
  });

  it("never pairs Amazon's inner (material) with What is in the set, nor item_dimensions with Form (owner, 2026-11-08)", () => {
    const contents = { key: "contents", label: "What is in the set", answers: [] };
    const form = { key: "itemForm", label: "Form", answers: [] };
    expect(propose({ name: "inner", label: "Inner", allowed: [] }, [contents, form], [])).not.toMatchObject({ fact: "contents" });
    expect(propose({ name: "item_dimensions", label: "Item Dimensions", allowed: [] }, [contents, form], [])).not.toMatchObject({ fact: "itemForm" });
    expect(propose({ name: "item_form", label: "Item Form", allowed: [] }, [form], [])).toMatchObject({ solution: FIELD_SOLUTION.REUSE, fact: "itemForm" });
  });

  it("keys a new answer by its words, and fingerprints a plan the same way twice", () => {
    expect(valueKey("Multi Colour / Printed")).toBe("multi-colour-printed");
    expect(planHash({ a: [1, 2] })).toBe(planHash({ a: [1, 2] }));
    expect(planHash({ a: [1, 2] })).not.toBe(planHash({ a: [2, 1] }));
  });
});

describe("a ticket is keyed by what fixes it, never by who hit it (D3)", () => {
  it("gives every shop's Tote bag the same fields ticket, whatever attributes each named", () => {
    const a = kindOf(MARKETPLACE_KIND.FIELDS)!.keyOf({ kind: MARKETPLACE_KIND.FIELDS, channel: "amazon", theirCategory: "TOTE_BAG", attributes: ["strap_type"] });
    const b = kindOf(MARKETPLACE_KIND.FIELDS)!.keyOf({ kind: MARKETPLACE_KIND.FIELDS, channel: "amazon", theirCategory: "TOTE_BAG", attributes: ["style"] });
    expect(a).toBe(b);
    expect(a).toBe("amazon-fields:amazon:TOTE_BAG");
  });

  it("groups the same refusal across shops into one issue (Sentry's fingerprint)", () => {
    const subject = { kind: ISSUE_KIND, source: "Amazon", context: "TOTE_BAG", subjectName: "purchasable_offer", code: "90220", message: "x" };
    expect(kindOf(ISSUE_KIND)!.keyOf(subject)).toBe("issue:Amazon:TOTE_BAG:purchasable_offer:90220");
  });
});

describe("a product's marketplace type, picked as readiness picks it", () => {
  const rows = [
    { productType: "bag", kind: null, theirCategory: "HANDBAG" },
    { productType: "bag", kind: "tote", theirCategory: "TOTE_BAG" },
  ];
  it("takes a kind's own row first, then the type's", () => {
    expect(channelSetupService.publishingOf(rows, "bag", "tote")).toBe("TOTE_BAG");
    expect(channelSetupService.publishingOf(rows, "bag", "sling")).toBe("HANDBAG");
    expect(channelSetupService.publishingOf(rows, "rida", null)).toBeNull();
  });
});

describe("neither side sees the other's (D11, Q3)", () => {
  // Compile-time lists: adding a shop field to the admin's DTO, or a step to the shop's, fails here.
  const adminKeys: Array<keyof AdminRequirementDTO> = ["id", "kind", "mode", "status", "title", "shopsWaiting", "reopened", "openedAt"];
  const shopKeys: Array<keyof ShopTicketDTO> = ["id", "type", "kind", "state", "title", "category", "names", "productId", "raisedAt"];
  it("gives the admin's requirement no shop, product or words, and the shop's ticket no plan or steps", () => {
    expect(adminKeys.some((k) => /org|shop(?!sWaiting)|product|words/i.test(k))).toBe(false);
    expect(shopKeys.some((k) => /plan|step|fields|hash/i.test(k))).toBe(false);
  });
});

/**
 * The team's bulk upload for a shop, the parts that need no database (own-store/bulk-sheet R9, D11):
 * the wizard reaches the admin routes, the reason is required by the one schema both ends read, the
 * body never names the shop, and ux.md's admin copy is said exactly.
 */
import { describe, expect, it } from "vitest";
import { productBulkBase } from "@/components/bulk-upload/bulkImportApiClient";
import { teamBulkProductCreateSchema } from "@/lib/validation/schemas/bulk-product.schema";
import { TEAM_BULK_COPY } from "@server/catalog/bulk/sheet-copy";

const row = {
  name: "Emerald abaya",
  description: "",
  price: 2499,
  categorySlug: "women",
  weight: 0.6,
  tags: [],
  images: ["a.jpg"],
  stock: { Main: 2 },
  imageUrls: { "a.jpg": "https://test.public.blob.vercel-storage.com/a.jpg" },
};

describe("R9 — the team's wizard talks to the team's routes", () => {
  it("the team's base is the admin path for that shop; the shop's is its own", () => {
    expect(productBulkBase("org1", true)).toBe("/api/admin/orgs/org1/products/bulk");
    expect(productBulkBase("org1", false)).toBe("/api/org/org1/products/bulk");
  });
});

describe("D11 — the team's create needs a reason", () => {
  const reasonIssue = (reason: unknown) =>
    teamBulkProductCreateSchema.safeParse({ rows: [row], reason }).error?.issues.find((issue) => issue.path[0] === "reason");

  it("a missing or blank reason is refused with ux.md's line", () => {
    for (const reason of [undefined, "", "   "]) expect(reasonIssue(reason)?.message).toBe("Say why — the shop will read it.");
  });

  it("a reason is accepted", () => {
    expect(reasonIssue("Shop emailed its sheet")).toBeUndefined();
  });
});

describe("ux.md — Admin bulk for shop copy", () => {
  it("says each state exactly", () => {
    expect(TEAM_BULK_COPY.banner("Noor Attar House")).toBe(
      "Uploading for Noor Attar House. The shop will see 'Edited by Bhendi Bazaar team'.",
    );
    expect(TEAM_BULK_COPY.reasonLabel).toBe("Why are you uploading for this shop?");
    expect(TEAM_BULK_COPY.done("Noor Attar House", 32, 8)).toBe(
      "Created 32 and updated 8 for Noor Attar House. Recorded in the activity log.",
    );
    expect(TEAM_BULK_COPY.viewProducts("Noor Attar House")).toBe("View Noor Attar House's products");
    expect(TEAM_BULK_COPY.noLocation("Noor Attar House")).toBe("Noor Attar House has no pickup address yet. Add one for them first.");
    expect(TEAM_BULK_COPY.deactivated("Noor Attar House")).toBe("Noor Attar House is deactivated. Reactivate it to add products.");
    expect(TEAM_BULK_COPY.openShop).toBe("Open shop");
  });
});

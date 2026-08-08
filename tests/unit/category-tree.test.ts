// The category tree's two app-enforced rules (category-tree TRD D1/D2) — subtree
// collection for category pages and the cycle guard for the write path — plus pins
// on what only the database enforces: both foreign keys must say RESTRICT, because
// deleting a category must never delete its products or orphan its children.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  collectSubtreeIds,
  wouldCreateCycle,
  type CategoryTreeNode,
} from "@server/catalog/category.tree";
import {
  categoryFormSchema,
  updateCategorySchema,
} from "@/lib/validation/schemas/category.schema";

// ridas ─┬─ bridal-ridas ── heavy-bridal
//        └─ daily-ridas
// kurtas (unrelated root)
const tree: CategoryTreeNode[] = [
  { id: "ridas", parentId: null },
  { id: "bridal-ridas", parentId: "ridas" },
  { id: "heavy-bridal", parentId: "bridal-ridas" },
  { id: "daily-ridas", parentId: "ridas" },
  { id: "kurtas", parentId: null },
];

describe("collectSubtreeIds", () => {
  it("returns just the category itself for a leaf", () => {
    expect(collectSubtreeIds(tree, "heavy-bridal")).toEqual(["heavy-bridal"]);
  });

  it("collects every descendant, transitively, and nothing else", () => {
    expect(collectSubtreeIds(tree, "ridas").sort()).toEqual([
      "bridal-ridas",
      "daily-ridas",
      "heavy-bridal",
      "ridas",
    ]);
  });

  it("collects a mid-tree subtree without its ancestors or siblings", () => {
    expect(collectSubtreeIds(tree, "bridal-ridas").sort()).toEqual([
      "bridal-ridas",
      "heavy-bridal",
    ]);
  });

  it("terminates on already-corrupt data instead of hanging", () => {
    const corrupt: CategoryTreeNode[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    expect(collectSubtreeIds(corrupt, "a").sort()).toEqual(["a", "b"]);
  });
});

describe("wouldCreateCycle", () => {
  it("refuses self-parenting — the one-step cycle", () => {
    expect(wouldCreateCycle(tree, "ridas", "ridas")).toBe(true);
  });

  it("refuses moving a category under its direct child", () => {
    expect(wouldCreateCycle(tree, "ridas", "bridal-ridas")).toBe(true);
  });

  it("refuses moving a category under a transitive descendant", () => {
    expect(wouldCreateCycle(tree, "ridas", "heavy-bridal")).toBe(true);
  });

  it("allows moving under a sibling", () => {
    expect(wouldCreateCycle(tree, "bridal-ridas", "daily-ridas")).toBe(false);
  });

  it("allows moving under an unrelated root", () => {
    expect(wouldCreateCycle(tree, "bridal-ridas", "kurtas")).toBe(false);
  });

  it("terminates on a pre-existing loop this write did not create", () => {
    const corrupt: CategoryTreeNode[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
      { id: "c", parentId: null },
    ];
    expect(wouldCreateCycle(corrupt, "c", "a")).toBe(false);
  });
});

describe("categoryFormSchema.parentId", () => {
  const base = { name: "Ridas", description: "d", heroImage: "h" };

  it("defaults to null — every category is a root unless said otherwise", () => {
    expect(categoryFormSchema.parse(base).parentId).toBeNull();
  });

  it('normalises "" (an unselected <select>) to null', () => {
    expect(categoryFormSchema.parse({ ...base, parentId: "" }).parentId).toBeNull();
  });

  it("passes a real id through", () => {
    expect(categoryFormSchema.parse({ ...base, parentId: "cat-1" }).parentId).toBe("cat-1");
  });

  it("stays absent on a PATCH that does not mention it", () => {
    expect("parentId" in updateCategorySchema.parse({})).toBe(false);
  });

  it("PATCH fires no defaults at all — unmentioned fields must stay unmentioned", () => {
    // Regression: `.partial()` kept the `.default()`s firing, so a PATCH that only
    // changed `order` also blanked description/heroImage and reset the accent.
    expect(updateCategorySchema.parse({ order: 5 })).toEqual({ order: 5 });
  });

  it('PATCH parentId: "" still normalises to null — an explicit detach', () => {
    expect(updateCategorySchema.parse({ parentId: "" }).parentId).toBeNull();
  });
});

describe("referential actions the database enforces", () => {
  const migration = readFileSync(
    "prisma/migrations/20260810120000_category_tree/migration.sql",
    "utf8"
  );
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("a parent with children cannot be deleted (parentId RESTRICT)", () => {
    expect(migration).toMatch(
      /Category_parentId_fkey"?\s+FOREIGN KEY \("parentId"\) REFERENCES "Category"\("id"\) ON DELETE RESTRICT/
    );
  });

  it("deleting a category can never delete its products (categoryId Cascade → RESTRICT)", () => {
    expect(migration).toMatch(
      /Product_categoryId_fkey"?\s+FOREIGN KEY \("categoryId"\) REFERENCES "Category"\("id"\) ON DELETE RESTRICT/
    );
    expect(schema).toMatch(
      /category\s+Category\s+@relation\(fields: \[categoryId\], references: \[id\], onDelete: Restrict\)/
    );
  });
});

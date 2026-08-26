// A `parent` cell used to be compared literally against slugs, so a category named
// "Men's Clothing" could not be referenced at all: its slug is `men-s-clothing`, and
// nothing in the sheet or the wizard ever showed that. The cell takes the name now.
import { describe, expect, it, vi } from "vitest";

const listIdentifiers = vi.fn();
const createMany = vi.fn();
vi.mock("@server/catalog/category.repository", () => ({
  categoryRepository: {
    listIdentifiers: () => listIdentifiers(),
    list: async () => [],
  },
}));
vi.mock("@server/shared/prisma", () => ({
  prisma: { category: { createMany: (args: unknown) => createMany(args) } },
}));

const { validateCategoryRows, createCategories } = await import(
  "@server/catalog/bulk/bulk-category.service"
);

const row = (rowNumber: number, name: string, parent?: string) => ({
  rowNumber,
  row: { name, description: "d", image: `${rowNumber}.jpg`, parent },
});
const files = ["2.jpg", "3.jpg", "4.jpg"];

const check = (rows: ReturnType<typeof row>[], existing: unknown[] = []) => {
  listIdentifiers.mockResolvedValue(existing);
  return validateCategoryRows(rows, files);
};
const parentErrors = async (...args: Parameters<typeof check>) =>
  (await check(...args)).filter((e) => e.field === "parent");

describe("a parent defined in the same sheet", () => {
  it("resolves when its row is above the child", async () => {
    expect(await check([row(2, "Mens Clothing"), row(3, "Shirts", "Mens Clothing")])).toEqual([]);
  });

  it("resolves by slug too — slugify is idempotent on one", async () => {
    expect(await check([row(2, "Mens Clothing"), row(3, "Shirts", "mens-clothing")])).toEqual([]);
  });

  it("resolves a name no one could slugify by eye", async () => {
    // The reported case. `Men's Clothing` -> `men-s-clothing`, not `mens-clothing`.
    expect(await check([row(2, "Men's Clothing"), row(3, "Shirts", "Men's Clothing")])).toEqual([]);
    expect(await check([row(2, "Abayas & Kaftans"), row(3, "Silk", "Abayas & Kaftans")])).toEqual([]);
  });

  it("says which row to move when the parent sits below the child", async () => {
    const errors = await parentErrors([row(2, "Shirts", "Mens Clothing"), row(3, "Mens Clothing")]);

    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
    expect(errors[0].message).toContain("row 3");
    expect(errors[0].message).toContain("move that row above this one");
  });

  it("refuses a row that names itself", async () => {
    const errors = await parentErrors([row(2, "Shirts", "Shirts")]);
    expect(errors[0].message).toBe("A category cannot be its own parent.");
  });
});

describe("a parent that already exists", () => {
  const abayas = { id: "c1", name: "Abayas", slug: "abayas" };

  it("resolves by slug", async () => {
    expect(await check([row(2, "Kaftans", "abayas")], [abayas])).toEqual([]);
  });

  it("resolves by name, in any casing", async () => {
    expect(await check([row(2, "Kaftans", "Abayas")], [abayas])).toEqual([]);
  });

  it("resolves a renamed category by its current name, whose slug is frozen", async () => {
    // Invariant 4: the slug is generated once and never follows the name.
    const renamed = { id: "c1", name: "Abayas & Kaftans", slug: "abayas" };
    expect(await check([row(2, "Silk"), row(3, "Wool", "Abayas & Kaftans")], [renamed])).toEqual([]);
  });

  it("breaks a shared name by slug, which is the only rule that reaches both", async () => {
    // Two categories are named "Abayas"; the second took `abayas-2`. Refusing the
    // word outright would make the first unreachable — "abayas" is its slug and
    // there is nothing else to type. So the exact slug wins, and the other is
    // reached by its own.
    const twins = [abayas, { id: "c2", name: "Abayas", slug: "abayas-2" }];

    expect(await check([row(2, "Kaftans", "abayas")], twins)).toEqual([]);
    expect(await check([row(2, "Kaftans", "abayas-2")], twins)).toEqual([]);
  });

  it("refuses when a renamed category's slug is another category's name", async () => {
    // `abayas` is the slug of a category now called Kaftans, and the name of a
    // different one. Precedence here would silently pick the wrong parent.
    const errors = await parentErrors(
      [row(2, "Silk", "Abayas")],
      [
        { id: "c1", name: "Kaftans", slug: "abayas" },
        { id: "c2", name: "Abayas", slug: "abayas-2" },
      ]
    );
    expect(errors[0].message).toContain("could mean");
    expect(errors[0].message).toContain("Kaftans");
  });

  it("still refuses a parent that matches nothing, and says what to write", async () => {
    const errors = await parentErrors([row(2, "Kaftans", "Nonexistent")], [abayas]);
    expect(errors[0].message).toContain("matches no existing category");
    expect(errors[0].message).toContain("exactly as it appears in its own name cell");
  });
});

describe("create resolves parents exactly as validate did", () => {
  const withUrl = (r: ReturnType<typeof row>) => ({
    ...r,
    row: { ...r.row, imageUrl: "https://x.public.blob.vercel-storage.com/a.jpg" },
  });

  it("wires an in-sheet child to the id generated for its parent row", async () => {
    listIdentifiers.mockResolvedValue([]);
    createMany.mockResolvedValue({ count: 2 });

    await createCategories([
      withUrl(row(2, "Men's Clothing")),
      withUrl(row(3, "Shirts", "Men's Clothing")),
    ]);

    const [parent, child] = createMany.mock.calls[0][0].data;
    expect(child.parentId).toBe(parent.id);
    // The slug nobody would have guessed, which is the whole reason the cell
    // takes a name.
    expect(parent.slug).toBe("men-s-clothing");
  });

  it("wires a child onto an existing category named in the cell", async () => {
    listIdentifiers.mockResolvedValue([{ id: "c1", name: "Abayas", slug: "abayas" }]);
    createMany.mockResolvedValue({ count: 1 });

    await createCategories([withUrl(row(2, "Silk", "Abayas"))]);

    expect(createMany.mock.calls[0][0].data[0].parentId).toBe("c1");
  });
});

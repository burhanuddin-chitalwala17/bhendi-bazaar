/**
 * Editing a product whose category has no type keeps every stored answer (product-form D5): the
 * form drops answers only for a category changed in this session, never on an unchanged one. The
 * real edit form submits; the real service saves; the row is read back.
 */
import "dotenv/config";
import { afterAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { isDisposableDb, ensureFixtures, setAnswers, answersOf } from "../helpers/test-db";
import type { ProductFormInput } from "@/components/product/console/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgId: "org-1" }),
  usePathname: () => "/org/org-1/products/p/edit",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/product/product-media-manager", () => ({ ProductMediaManager: () => null }));

describe.skipIf(!isDisposableDb)("editing a no-type product (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  const ids: string[] = [];

  afterAll(async () => {
    if (prisma) await prisma.product.deleteMany({ where: { id: { in: ids } } });
  });

  it("an edit that changes only the name keeps every fact and measurement, a marketplace one included", async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    const { productsService } = await import("@server/catalog/admin.product.service");
    const { adminProductsDAL } = await import("@/data-access-layer/admin/products.dal");
    const { ProductForm } = await import("@/components/shared/forms/product");
    const { orgId, orgAddressId, categoryId, userId } = await ensureFixtures();

    const stamp = `pek-${Date.now().toString(36)}`;
    const facts = {
      colour: { value: "black", origin: "product" },
      material: { value: "crepe", origin: "marketplace", source: { channel: "amazon", value: "Crepe", readAt: "2026-10-01" } },
    };
    const measurements = { length: { value: 54, origin: "product" } };
    const { id } = await prisma.product.create({
      data: {
        slug: stamp,
        name: `Edit test ${stamp}`,
        description: "Created by tests/integration/product-edit-keeps-facts.test.tsx",
        price: 99_900,
        weight: 0.5,
        categoryId,
        orgId,
        thumbnail: "https://placehold.co/600x600",
        media: { create: { kind: "IMAGE", ref: "https://placehold.co/600x600", position: 0, isThumbnail: true } },
        stockLocations: { create: { orgAddressId, quantity: 3 } },
      },
      select: { id: true },
    });
    ids.push(id);
    await setAnswers(id, { facts, measurements, weight: 0.5 });

    const product = await adminProductsDAL.getProductById(id);
    const onSubmit = vi.fn(async (data: ProductFormInput) => {
      await productsService.updateProduct(id, { ...data, seenVersion: data.seenVersion! }, { userId, team: false });
      return product;
    });
    render(
      <ProductForm
        product={product}
        categories={[{ id: categoryId, name: "Test Fixtures" }]}
        orgs={[{ id: orgId, name: "Fixture", code: "F", handle: "f" }]}
        locations={[{ id: orgAddressId, name: "Fixture warehouse", city: "Mumbai", pincode: "400001", isActive: true }]}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^What it is/ }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: `Renamed ${stamp}` } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await onSubmit.mock.results[0].value;

    const saved = { ...(await prisma.product.findUniqueOrThrow({ where: { id }, select: { name: true } })), ...(await answersOf(id)) };
    expect(saved.name).toBe(`Renamed ${stamp}`);
    expect(saved.facts).toMatchObject({ colour: { value: "black" }, material: { value: "crepe", origin: "marketplace" } });
    expect(saved.measurements).toMatchObject({ length: { value: 54 } });
  });
});

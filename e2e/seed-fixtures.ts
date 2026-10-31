import { ensureFixtures, isDisposableDb } from "../tests/helpers/test-db";
import { E2E_PRODUCT } from "./fixtures";

/**
 * Builds the journeys' world on the throwaway database, through the same fixtures the
 * integration suites use. The seed refuses CI (Invariant 7) and is not needed: one product in
 * the fixture category is all a browse-to-cart journey reads. Run under `tsx`, which resolves the
 * `@server/*` paths server code imports; Playwright's loader does not (e2e/global-setup.ts).
 */
async function seedFixtures() {
  if (!isDisposableDb) {
    throw new Error(
      "e2e writes fixture rows, so it runs only against a local throwaway database " +
        "(tests/helpers/test-db.ts DISPOSABLE_DATABASES). DATABASE_URL names something else.",
    );
  }
  const fixtures = await ensureFixtures();
  const { prisma } = await import("@server/shared/prisma");

  // The whole fixed shape on both branches, so a reused dev database cannot drift it.
  const shape = {
    name: E2E_PRODUCT.name,
    description: "Created by e2e/seed-fixtures.ts.",
    price: E2E_PRODUCT.pricePaise,
    categoryId: fixtures.categoryId,
    orgId: fixtures.orgId,
    thumbnail: "/brand/og-image.jpeg",
    sku: E2E_PRODUCT.sku,
    archivedAt: null,
  };
  const product = await prisma.product.upsert({
    where: { slug: E2E_PRODUCT.slug },
    update: shape,
    create: { slug: E2E_PRODUCT.slug, ...shape },
    select: { id: true },
  });

  // Stock is reset every run: a journey that reached checkout would otherwise drain it.
  await prisma.productStock.upsert({
    where: { productId_orgAddressId: { productId: product.id, orgAddressId: fixtures.orgAddressId } },
    update: { quantity: E2E_PRODUCT.stock },
    create: { productId: product.id, orgAddressId: fixtures.orgAddressId, quantity: E2E_PRODUCT.stock },
  });

  await prisma.$disconnect();
}

seedFixtures().catch((error) => {
  console.error(error);
  process.exit(1);
});

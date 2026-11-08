/**
 * What a test may treat as a throwaway database, declared once.
 *
 * Nine integration suites each wrote their own version of this predicate and three of the
 * spellings disagreed: `=== "/bhendi_bazaar_dev"` in six of them, a two-name list in two, and
 * `.includes("bhendi_bazaar_dev")` in the last. CI runs against `bhendi_bazaar_ci`, so the six
 * exact-match suites — including `order-transaction`, which is the guard on Invariants 1, 3 and
 * 6 — skipped every run and reported nothing. A skipped suite is not a passing suite, but it
 * looks like one at the bottom of the output.
 *
 * `tests/unit/test-integrity.test.ts` fails if a suite declares its own copy of this, and fails
 * if the predicate is false while `CI` is set — the integration layer must not be able to
 * vanish quietly.
 */
/**
 * The client is imported where it is used, never at module scope.
 *
 * It used to be imported here, and an import is evaluated before any statement in the file that
 * imports it — so a suite setting `PRISMA_LOG_QUERIES` at its top had the client already built
 * without the query listener, and `db-ops-budget.test.ts` counted zero for every budget it
 * claimed to enforce. Eight assertions of the form `expect(0).toBeLessThanOrEqual(1)` passed for
 * two months. Asking whether this database is disposable must not construct a client.
 */
const client = async () => (await import("@server/shared/prisma")).prisma;

/** Databases whose rows exist to be created and destroyed. Never a metered or shared one. */
export const DISPOSABLE_DATABASES = ["/bhendi_bazaar_dev", "/bhendi_bazaar_ci"] as const;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/** May this run create, mutate and delete rows? */
export const isDisposableDb = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return (
      LOCAL_HOSTS.includes(url.hostname) &&
      (DISPOSABLE_DATABASES as readonly string[]).includes(url.pathname)
    );
  } catch {
    return false;
  }
})();

export interface Fixtures {
  orgId: string;
  /** A second org, for the tests that check one org cannot reach another's rows. */
  otherOrgId: string;
  orgAddressId: string;
  categoryId: string;
  categorySlug: string;
  userId: string;
  shippingProviderId: string;
}

/** Keys of the fixture world. Fixed, so every run reuses the same rows rather than leaking new ones. */
export const FIXTURE_KEYS = {
  orgCode: "TEST-FIXTURE-ORG",
  orgHandle: "test-fixture-org",
  otherOrgCode: "TEST-FIXTURE-ORG-2",
  otherOrgHandle: "test-fixture-org-2",
  categorySlug: "test-fixtures",
  userEmail: "fixtures@example.invalid",
  providerCode: "test-fixture-carrier",
} as const;

const FIXTURE_IMAGE = "/brand/bhendi-bazaar.png";

/**
 * The smallest world an integration test needs, owned by the tests and nobody else.
 *
 * It used to borrow the first org, category, user and carrier in the database with `findFirst`,
 * so on the dev database a suite's setup and teardown wrote to the owner's real rows: category
 * product types reset to null, an org's sales channels and colour values deleted. Every row here
 * is found or created by a fixed test key, so a suite can mutate it freely and real data is never
 * in reach. `tests/unit/test-integrity.test.ts` keeps it that way.
 */
export async function ensureFixtures(): Promise<Fixtures> {
  const prisma = await client();

  const fixtureOrg = (code: string, handle: string, name: string) =>
    prisma.org.upsert({
      where: { code },
      update: {},
      create: {
        code,
        handle,
        name,
        email: `${handle}@example.invalid`,
        profile: { create: {} },
        listingDefaults: { create: {} },
      },
      select: { id: true },
    });

  const [org, otherOrg] = await Promise.all([
    fixtureOrg(FIXTURE_KEYS.orgCode, FIXTURE_KEYS.orgHandle, "Test Fixture Org"),
    fixtureOrg(FIXTURE_KEYS.otherOrgCode, FIXTURE_KEYS.otherOrgHandle, "Test Fixture Org (second)"),
  ]);

  const location =
    (await prisma.orgAddress.findFirst({
      where: { orgId: org.id, isActive: true },
      select: { id: true, orgId: true },
    })) ??
    (await prisma.orgAddress.create({
      data: {
        org: { connect: { id: org.id } },
        address: {
          create: {
            addressLine1: "1 Fixture Road",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
          },
        },
        name: "Fixture warehouse",
        contactName: "Fixture",
        contactPhone: "9999999999",
        isActive: true,
      },
      select: { id: true, orgId: true },
    }));

  const [category, user, provider] = await Promise.all([
    // A shipped local image: the fixture category persists on the dev database and the admin
    // table renders its hero through next/image, which refuses any unconfigured host.
    prisma.category.upsert({
      where: { slug: FIXTURE_KEYS.categorySlug },
      update: { heroImage: FIXTURE_IMAGE },
      create: {
        name: "Test Fixtures",
        slug: FIXTURE_KEYS.categorySlug,
        description: "Created by the integration fixtures.",
        heroImage: FIXTURE_IMAGE,
      },
      select: { id: true, slug: true },
    }),
    prisma.user.upsert({
      where: { email: FIXTURE_KEYS.userEmail },
      update: {},
      create: { name: "Fixture User", email: FIXTURE_KEYS.userEmail },
      select: { id: true },
    }),
    prisma.shippingProvider.upsert({
      where: { code: FIXTURE_KEYS.providerCode },
      update: {},
      create: { code: FIXTURE_KEYS.providerCode, name: "Fixture Carrier" },
      select: { id: true },
    }),
  ]);

  return {
    orgId: location.orgId,
    otherOrgId: otherOrg.id,
    orgAddressId: location.id,
    categoryId: category.id,
    categorySlug: category.slug,
    userId: user.id,
    shippingProviderId: provider.id,
  };
}

/** An org membership for `userId`, so a test can act as someone with a seat. */
export async function ensureOrgMember(
  orgId: string,
  userId: string,
): Promise<{ orgId: string; userId: string }> {
  const prisma = await client();
  const existing = await prisma.orgMember.findFirst({
    where: { orgId, userId },
    select: { orgId: true, userId: true },
  });
  if (existing) return existing;
  return prisma.orgMember.create({
    data: { orgId, userId, role: "OWNER" },
    select: { orgId: true, userId: true },
  });
}

/**
 * Does this database hold a catalogue to read?
 *
 * For the suites that compare *strategies* rather than results: they need real rows with real
 * relations, and on an empty schema they either throw or — worse — pass by comparing two empty
 * arrays. The seed is destructive and refuses to run in CI (Invariant 7), so those suites are
 * dev-only by construction. `tests/unit/test-integrity.test.ts` keeps the list of which, and
 * lets it shrink only.
 */
export async function hasCatalogueData(): Promise<boolean> {
  if (!isDisposableDb) return false;
  try {
    const prisma = await client();
    const [products, orders, reviews, promotions, carts] = await Promise.all([
      prisma.product.count({ take: 1 }),
      prisma.order.count({ take: 1 }),
      prisma.review.count({ take: 1 }),
      prisma.promotion.count({ take: 1 }),
      prisma.cart.count({ take: 1 }),
    ]);
    return products > 0 && orders > 0 && reviews > 0 && promotions > 0 && carts > 0;
  } catch {
    return false;
  }
}

/**
 * A fixture product's answers, written as the app writes them since the switch (listing-model/dynamic-form
 * Q16): into the value rows, never onto the product row.
 */
export async function setAnswers(productId: string, answers: { facts?: unknown; measurements?: unknown; weight?: number | null }): Promise<void> {
  const { prisma } = await import("@server/shared/prisma");
  const { productValueRepository } = await import("@server/listing/product-value.repository");
  // The function replaces the weight row too, so an omitted weight keeps the product's own rather than erasing it.
  const weight = answers.weight !== undefined ? answers.weight : (await prisma.product.findUnique({ where: { id: productId }, select: { weight: true } }))?.weight ?? null;
  await productValueRepository.writeAnswersIn(prisma, productId, { ...answers, weight });
}

/** A product's answers as every reader now reads them (dynamic-form Q16). */
export async function answersOf(productId: string): Promise<{ facts: Record<string, unknown>; measurements: Record<string, unknown> }> {
  const { productValueRepository } = await import("@server/listing/product-value.repository");
  return await productValueRepository.answersOf(productId);
}

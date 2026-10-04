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

/**
 * The smallest world an integration test needs, created if the schema is empty.
 *
 * Every suite that needed these read them with `findFirstOrThrow` against the *seeded* dev
 * database, which is why none of them could run anywhere else: on CI's empty schema the fixture
 * threw before the first assertion. A test that cannot construct its own world is a test that
 * only runs where someone already built one — and six of them had not run in CI since the day
 * they were written.
 *
 * Find-or-create rather than create: on the dev database this reuses the seed and writes
 * nothing, so it costs one query per row there and builds the world only where it is missing.
 */
export async function ensureFixtures(): Promise<Fixtures> {
  const prisma = await client();
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const location =
    (await prisma.orgAddress.findFirst({
      where: { isActive: true },
      select: { id: true, orgId: true },
    })) ??
    (await (async () => {
      const [org, address] = await Promise.all([
        prisma.org.create({
          data: {
            code: `SEL-TEST-${unique}`,
            handle: `test-fixture-${unique}`,
            name: "Test Fixture Org",
            email: "fixtures@example.invalid",
          },
          select: { id: true },
        }),
        prisma.address.create({
          data: {
            addressLine1: "1 Fixture Road",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
          },
          select: { id: true },
        }),
      ]);
      return prisma.orgAddress.create({
        data: {
          orgId: org.id,
          addressId: address.id,
          name: "Fixture warehouse",
          contactName: "Fixture",
          contactPhone: "9999999999",
          isActive: true,
        },
        select: { id: true, orgId: true },
      });
    })());

  const category =
    (await prisma.category.findFirst({ select: { id: true, slug: true } })) ??
    (await prisma.category.create({
      data: {
        name: "Test Fixtures",
        slug: `test-fixtures-${unique}`,
        description: "Created by the integration fixtures.",
        heroImage: "https://example.invalid/hero.webp",
      },
      select: { id: true, slug: true },
    }));

  const otherOrg =
    (await prisma.org.findFirst({
      where: { id: { not: location.orgId } },
      select: { id: true },
    })) ??
    (await prisma.org.create({
      data: {
        code: `SEL-TEST2-${unique}`,
        handle: `test-fixture-other-${unique}`,
        name: "Test Fixture Org (second)",
        email: "fixtures2@example.invalid",
      },
      select: { id: true },
    }));

  const user =
    (await prisma.user.findFirst({ select: { id: true } })) ??
    (await prisma.user.create({
      data: { name: "Fixture User", email: `fixtures-${unique}@example.invalid` },
      select: { id: true },
    }));

  const provider =
    (await prisma.shippingProvider.findFirst({ select: { id: true } })) ??
    (await prisma.shippingProvider.create({
      data: { code: `fixture-${unique}`, name: "Fixture Carrier" },
      select: { id: true },
    }));

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

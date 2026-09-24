/**
 * Adding a promotion actually lands, and comes back on the storefront read.
 *
 * Written after the editor's add button appeared to work and left the table empty:
 * every unit test mocked the repository, so nothing exercised the one path that
 * matters — schema, service, Prisma write, storefront read — against a real database.
 *
 * Needs the seeded local database; skips anywhere else.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";


describe.runIf(isDisposableDb)("an org promotion survives the round trip", () => {
  it("is created, read back, and reaches the storefront", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { storefrontService } = await import("@server/catalog/storefront.service");
    const { orgBannerSchema } = await import(
      "@/lib/validation/schemas/org-banner.schema"
    );

    const { orgId } = await ensureFixtures();
    const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });

    // Exactly what the editor posts.
    const body = orgBannerSchema.parse({
      title: "Round-trip probe",
      href: `/store/${org.handle}`,
      imageUrl: null,
      isActive: true,
    });

    const created = await storefrontService.addBanner(org.id, body);
    try {
      expect(created.id).toBeTruthy();
      expect(created.orgId).toBe(org.id);

      const listed = await storefrontService.listBanners(org.id);
      expect(listed.map((b) => b.id)).toContain(created.id);

      // The storefront read is the one the page actually uses.
      const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
      const promotions = await storefrontDAL.promotionsFor(org.id);
      expect(promotions.map((p) => p.id)).toContain(created.id);
      expect(promotions.find((p) => p.id === created.id)?.title).toBe(
        "Round-trip probe"
      );
    } finally {
      await prisma.orgBanner.delete({ where: { id: created.id } });
    }
  });
});

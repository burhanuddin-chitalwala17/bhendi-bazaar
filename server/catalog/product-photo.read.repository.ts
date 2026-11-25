import { prisma } from "@server/shared/prisma";

/**
 * Gallery photos as other domains read them; writes stay in product.repository.ts. Its own file
 * because product.read.repository.ts is pinned at its size (tests/unit/file-size.test.ts).
 */
export const productPhotoRepository = {
  /**
   * Each of this org's named products' first gallery photo that is a ready picture in the org's own
   * library (ai-images/social-posts D1). A product with none, or another org's, is absent.
   */
  async mainPhotos(orgId: string, productIds: readonly string[]): Promise<Map<string, { id: string; ref: string }>> {
    if (productIds.length === 0) return new Map();
    const rows = await prisma.productMedia.findMany({
      where: {
        productId: { in: [...productIds] },
        product: { orgId },
        kind: "IMAGE",
        asset: { orgId, kind: "IMAGE", state: "READY", objectKey: { not: null } },
      },
      orderBy: [{ productId: "asc" }, { position: "asc" }],
      distinct: ["productId"],
      select: { productId: true, asset: { select: { id: true, ref: true } } },
    });
    return new Map(rows.flatMap((row) => (row.asset ? [[row.productId, row.asset] as const] : [])));
  },
};

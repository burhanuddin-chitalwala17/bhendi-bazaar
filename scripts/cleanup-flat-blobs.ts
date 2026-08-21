/**
 * Deletes old flat-layout product images from Blob — files under `products/`
 * with no folder structure and no reference from any product
 * (bulk-catalog-upload R13/D9).
 *
 * Deliberately two intents, like the seed guard:
 *
 *   npx tsx scripts/cleanup-flat-blobs.ts            # dry-run: prints what would go
 *   CLEANUP_ALLOW_DELETE=1 npx tsx scripts/cleanup-flat-blobs.ts --delete
 *
 * The keep-set is every ProductMedia ref and every Product.thumbnail, so a file
 * any product still points at is never deleted, whatever folder it is in.
 */
import "dotenv/config";
import { list, del } from "@vercel/blob";
import { prisma } from "../server/shared/prisma";

async function main() {
  const wantsDelete = process.argv.includes("--delete");
  const allowed = process.env.CLEANUP_ALLOW_DELETE === "1";
  if (wantsDelete && !allowed) {
    throw new Error(
      "Refusing to delete: set CLEANUP_ALLOW_DELETE=1 as well. Dry-run needs no flags."
    );
  }

  const [media, products] = await Promise.all([
    prisma.productMedia.findMany({ where: { kind: "IMAGE" }, select: { ref: true } }),
    prisma.product.findMany({ select: { thumbnail: true } }),
  ]);
  const referenced = new Set<string>([
    ...media.map((row) => row.ref),
    ...products.map((row) => row.thumbnail).filter(Boolean),
  ]);
  const dbHost = new URL(process.env.DATABASE_URL ?? "").hostname;
  console.log(
    `Keep-set: ${referenced.size} referenced image URLs, read from ${dbHost}.\n` +
      `⚠️  The Blob store is shared across environments; this database is the only\n` +
      `   reference source consulted. Delete only when DATABASE_URL points at the\n` +
      `   environment these blobs serve — after it is fully re-onboarded.`
  );

  let cursor: string | undefined;
  let kept = 0;
  const doomed: { url: string; pathname: string; size: number }[] = [];
  do {
    const page = await list({ prefix: "products/", cursor, limit: 1000 });
    for (const blob of page.blobs) {
      // Flat layout = a file directly under products/, no subfolder. The new
      // structured layout (products/<org>/<product>/...) is never touched.
      const isFlat = !blob.pathname.slice("products/".length).includes("/");
      if (!isFlat || referenced.has(blob.url)) {
        kept++;
        continue;
      }
      doomed.push({ url: blob.url, pathname: blob.pathname, size: blob.size });
    }
    cursor = page.cursor;
  } while (cursor);

  const mb = (doomed.reduce((sum, b) => sum + b.size, 0) / 1024 / 1024).toFixed(1);
  console.log(`${kept} blobs kept (structured or referenced)`);
  console.log(`${doomed.length} unreferenced flat blobs (${mb} MB):`);
  for (const blob of doomed) console.log(`  ${blob.pathname}`);

  if (!wantsDelete) {
    console.log("\nDry-run only. Re-run with CLEANUP_ALLOW_DELETE=1 and --delete to remove them.");
    return;
  }
  if (doomed.length) {
    await del(doomed.map((b) => b.url));
    console.log(`\nDeleted ${doomed.length} blobs.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

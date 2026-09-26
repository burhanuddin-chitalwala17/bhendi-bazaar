// Bring every stored image under the media library's record (media-library trd D3).
//   npx tsx scripts/backfill-media-assets.ts           report only
//   npx tsx scripts/backfill-media-assets.ts --write   create assets and link rows
// Idempotent; safe to re-run. Reads DATABASE_URL and the R2 variables from the environment.
import "dotenv/config";
import { backfillMediaAssets } from "@server/catalog/media-backfill";
import { prisma } from "@server/shared/prisma";

const write = process.argv.includes("--write");
backfillMediaAssets({ write, log: console.log })
  .then(async (report) => {
    for (const ref of report.withoutDimensions) console.warn(`no dimensions: ${ref}`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

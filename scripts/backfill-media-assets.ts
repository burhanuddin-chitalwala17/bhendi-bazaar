// Bring every stored image under the media library's record (media-library trd D3).
//   npx tsx scripts/backfill-media-assets.ts           report only
//   npx tsx scripts/backfill-media-assets.ts --write   create assets and link rows
// Idempotent; safe to re-run. Reads DATABASE_URL and the R2 variables from the environment,
// so point it at one database with `--env-file`; a name that file omits falls back to `.env`.
// A write stops if no stored URL belongs to the configured store — the shape of a production
// database paired with a development bucket. `--allow-foreign` is how a library of genuinely
// external URLs says so.
import "dotenv/config";
import { backfillMediaAssets } from "@server/catalog/media-backfill";
import { prisma } from "@server/shared/prisma";

const write = process.argv.includes("--write");
const allowForeign = process.argv.includes("--allow-foreign");
backfillMediaAssets({ write, allowForeign, log: console.log })
  .then(async (report) => {
    for (const ref of report.withoutDimensions) console.warn(`no dimensions: ${ref}`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

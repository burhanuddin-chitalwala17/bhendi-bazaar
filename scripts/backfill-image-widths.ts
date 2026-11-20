// Give every photograph already in the bucket its width copies (ADR-0075).
//   npx tsx --env-file=.env.prod scripts/backfill-image-widths.ts           report only
//   npx tsx --env-file=.env.prod scripts/backfill-image-widths.ts --write   write the copies
// Run with --write BEFORE deploying the image loader: once it is live, a photograph without
// copies renders broken. Only adds objects, never changes or removes one; safe to re-run.
import "dotenv/config";
import { ensureWidthCopies, listObjectKeys } from "@server/catalog/object-store";
import { DELIVERY_WIDTHS, hasWidthCopies, widthPathFor } from "@server/catalog/image-widths";

const write = process.argv.includes("--write");
const CONCURRENCY = 4;

async function allKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let next: string | null | undefined;
  do {
    const page = await listObjectKeys(next ?? undefined);
    page.keys.forEach((key) => keys.add(key));
    next = page.next;
  } while (next);
  return keys;
}

async function main() {
  const keys = await allKeys();
  const missing = [...keys].filter(
    (key) => hasWidthCopies(key) && DELIVERY_WIDTHS.some((width) => !keys.has(widthPathFor(key, width))),
  );
  console.log(`${keys.size} objects; ${missing.length} photographs without all their width copies.`);
  if (!write) {
    missing.slice(0, 20).forEach((key) => console.log(`  ${key}`));
    console.log("Report only. Re-run with --write to make them.");
    return;
  }

  let done = 0;
  const failed: string[] = [];
  const queue = [...missing];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let key = queue.shift(); key; key = queue.shift()) {
        try {
          await ensureWidthCopies(key);
        } catch (error) {
          failed.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
        }
        done += 1;
        if (done % 25 === 0) console.log(`  ${done}/${missing.length}`);
      }
    }),
  );
  console.log(`Wrote copies for ${done - failed.length} of ${missing.length}.`);
  failed.forEach((line) => console.error(`  failed ${line}`));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

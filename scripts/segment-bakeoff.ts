// The same real photographs through every cut-out service we could use, side by side, so the
// platform owner chooses from outputs rather than from claims (image-enhancement spec R8, A6;
// trd D10).
//
//   npm run enhance:bakeoff -- --org <orgId> [--limit 20]
//
// Records nothing in the ledger and creates no asset: results are loose objects under a prefix
// nothing lists, and the page linking them is one more object. Reads DATABASE_URL and the R2
// variables, plus whatever the services themselves need, from the environment.
import "dotenv/config";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { adminOrgService } from "@server/catalog/org.service";
import { availableSegmenters } from "@server/content/providers";
import { prisma } from "@server/shared/prisma";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";

/** Where a bake-off's output sits: beside the proposals, in a prefix no library lists. */
const BAKEOFF_PREFIX = "bakeoff/";
const DEFAULT_LIMIT = 20;
/** A ceiling, because every photograph past this one is a bill and the answer is legible long before. */
const MAX_LIMIT = 100;

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Attempt {
  provider: string;
  url: string | null;
  elapsedMs: number;
  error: string | null;
}

interface Row {
  assetId: string;
  sourceUrl: string;
  attempts: Attempt[];
}

/**
 * One plain page: a row per photograph, the original beside each service's cut-out shown twice —
 * on mid-grey, where a halo and a missed edge show, and on white, which is what the result is
 * actually for. The provider's key and how long it took sit under each.
 */
function page(orgName: string, runId: string, rows: Row[]): string {
  const cells = (row: Row) =>
    row.attempts
      .map((attempt) => {
        const picture = attempt.url
          ? `<div class="pair"><div class="grey"><img src="${escape(attempt.url)}" alt=""></div>` +
            `<div class="white"><img src="${escape(attempt.url)}" alt=""></div></div>`
          : `<div class="failed">${escape(attempt.error ?? "no result")}</div>`;
        return `<td>${picture}<p>${escape(attempt.provider)} · ${attempt.elapsedMs} ms</p></td>`;
      })
      .join("");

  const body = rows
    .map(
      (row) =>
        `<tr><td><div class="pair"><div class="grey"><img src="${escape(row.sourceUrl)}" alt=""></div></div>` +
        `<p>original</p></td>${cells(row)}</tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cut-out bake-off — ${escape(orgName)}</title>
<style>
 body { font: 14px system-ui, sans-serif; margin: 16px; color: #111; }
 table { border-collapse: collapse; }
 td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
 .pair { display: flex; gap: 8px; }
 .grey, .white { width: 180px; height: 180px; display: flex; align-items: center; justify-content: center; }
 .grey { background: #808080; }
 .white { background: #fff; border: 1px solid #eee; }
 img { max-width: 100%; max-height: 100%; }
 p { margin: 6px 0 0; font-size: 12px; color: #555; }
 .failed { width: 368px; color: #b00; font-size: 12px; }
</style></head>
<body>
<h1>Cut-out bake-off</h1>
<p>${escape(orgName)} · run ${escape(runId)} · ${rows.length} photograph(s)</p>
<table>${body}</table>
</body></html>`;
}

/** The org's newest ready photographs, paging the library until there are enough or it runs out. */
async function newestPhotographs(orgId: string, limit: number): Promise<string[]> {
  const ids: string[] = [];
  for (let pageNumber = 1; ids.length < limit; pageNumber += 1) {
    const { assets, pagination } = await mediaAssetService.listLibrary(
      orgId,
      parseMediaLibraryFilters({ kind: "IMAGE", page: String(pageNumber) }),
    );
    for (const asset of assets) {
      if (asset.state === "READY" && ids.length < limit) ids.push(asset.id);
    }
    if (pageNumber >= pagination.totalPages) break;
  }
  return ids;
}

async function main() {
  const orgId = flag("org");
  if (!orgId) throw new Error("Which shop? Pass --org <orgId>.");
  const limit = Math.min(MAX_LIMIT, Number(flag("limit") ?? DEFAULT_LIMIT));
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a whole number of photographs.");

  const [org] = await adminOrgService.summariesFor([orgId]);
  if (!org) throw new Error(`No shop with id ${orgId}.`);

  const segmenters = availableSegmenters();
  if (segmenters.length === 0) throw new Error("No cut-out service is configured, so there is nothing to compare.");

  const assetIds = await newestPhotographs(orgId, limit);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(
    `Bake-off ${runId}: ${org.name} (${org.code}) — ${assetIds.length} photograph(s) through ` +
      `${segmenters.map((s) => s.key).join(", ")}.`,
  );
  if (assetIds.length === 0) return;

  const rows: Row[] = [];
  for (const assetId of assetIds) {
    const source = await mediaAssetService.readImageBytes(assetId);
    const attempts: Attempt[] = [];
    for (const segmenter of segmenters) {
      const startedAt = Date.now();
      try {
        const cut = await segmenter.cutOut(source);
        const key = `${BAKEOFF_PREFIX}${runId}/${assetId}-${segmenter.key}.png`;
        attempts.push({
          provider: segmenter.key,
          url: await mediaAssetService.putLooseObject(key, cut, "image/png"),
          elapsedMs: Date.now() - startedAt,
          error: null,
        });
      } catch (error) {
        attempts.push({
          provider: segmenter.key,
          url: null,
          elapsedMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    rows.push({ assetId, sourceUrl: mediaAssetService.publicUrlOf(source.objectKey), attempts });
    console.log(`  ${assetId}: ${attempts.map((a) => `${a.provider} ${a.error ? "failed" : `${a.elapsedMs}ms`}`).join(", ")}`);
  }

  const indexKey = `${BAKEOFF_PREFIX}${runId}/index.html`;
  const url = await mediaAssetService.putLooseObject(
    indexKey,
    Buffer.from(page(org.name, runId, rows), "utf8"),
    "text/html; charset=utf-8",
  );
  console.log(`\nSide by side: ${url}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });

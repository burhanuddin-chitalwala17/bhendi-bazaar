// The same real photographs through several image models, side by side with each one's cost and
// time, so the model a purpose uses is chosen on evidence (generation-foundation spec R9, A4; trd D10).
//
//   npm run generate:bakeoff -- --org <orgId> --models cf/flux-2-klein-4b,fal/bria-product-shot \
//     [--purpose scene --preset wooden-table | --purpose listing --prompt "worn in a courtyard"] [--limit 20]
//
// Each model is called alone — no fallback — so a failure shows as that model's failure. Records no
// generation and no enhancement: outputs are loose objects under a prefix nothing lists, and the
// page linking them is one more. Reads DATABASE_URL, the R2 variables and each provider's own.
import "dotenv/config";
import sharp from "sharp";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { adminOrgService } from "@server/catalog/org.service";
import { segmenterFor } from "@server/content/providers";
import { cutOutProduct } from "@server/content/tools/cutout";
import { SCENE_PRESET, type ScenePresetKey } from "@server/content/scene-presets";
import { GENERATION_ASPECT, GENERATION_PURPOSE, GENERATION_SIZE } from "@server/content/generation/generation.types";
import { modelById, type ModelEntry } from "@server/content/generation/registry";
import { canTake, routeCall } from "@server/content/generation/router";
import { scenePrompt, withBrief } from "@server/content/generation/prompts";
import { microUsdToPaise, priceMicroUsd, REFERENCE_LONG_EDGE } from "@server/content/generation/pricing";
import { rateFor } from "@server/content/generation/exchange-rate";
import { prisma } from "@server/shared/prisma";
import { BAKEOFF_PREFIX, escape, flag, limitFlag, newestPhotographs } from "./bakeoff-shared";

interface Attempt {
  model: string;
  url: string | null;
  elapsedMs: number;
  rupees: string;
  error: string | null;
}

interface Row {
  assetId: string;
  sourceUrl: string;
  attempts: Attempt[];
}

const rupees = (paise: number) => `₹${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;

function page(orgName: string, runId: string, prompt: string, rows: Row[], totals: Map<string, number>): string {
  const cells = (row: Row) =>
    row.attempts
      .map((a) => {
        const picture = a.url
          ? `<div class="pic"><img src="${escape(a.url)}" alt=""></div>`
          : `<div class="failed">${escape(a.error ?? "no result")}</div>`;
        return `<td>${picture}<p>${escape(a.model)} · ${a.rupees} · ${a.elapsedMs} ms</p></td>`;
      })
      .join("");
  const body = rows
    .map((row) => `<tr><td><div class="pic"><img src="${escape(row.sourceUrl)}" alt=""></div><p>original</p></td>${cells(row)}</tr>`)
    .join("\n");
  const summary = [...totals.entries()].map(([model, paise]) => `${escape(model)} ${rupees(paise)}`).join(" · ");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Model bake-off — ${escape(orgName)}</title>
<style>
 body { font: 14px system-ui, sans-serif; margin: 16px; color: #111; }
 table { border-collapse: collapse; }
 td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
 .pic { width: 260px; height: 260px; display: flex; align-items: center; justify-content: center; background: #f4f4f4; }
 img { max-width: 100%; max-height: 100%; }
 p { margin: 6px 0 0; font-size: 12px; color: #555; }
 .failed { width: 260px; color: #b00; font-size: 12px; }
</style></head>
<body>
<h1>Model bake-off</h1>
<p>${escape(orgName)} · run ${escape(runId)} · ${rows.length} photograph(s)</p>
<p>Prompt: ${escape(prompt)}</p>
<p>Spent: ${summary}</p>
<table>${body}</table>
</body></html>`;
}

async function main() {
  const orgId = flag("org");
  if (!orgId) throw new Error("Which shop? Pass --org <orgId>.");
  const limit = limitFlag();
  const purpose = flag("purpose") === GENERATION_PURPOSE.LISTING ? GENERATION_PURPOSE.LISTING : GENERATION_PURPOSE.SCENE;
  const preset = SCENE_PRESET[(flag("preset") ?? "wooden-table") as ScenePresetKey];
  if (purpose === GENERATION_PURPOSE.SCENE && !preset) throw new Error("--preset must be one of the scene settings.");
  const brief = flag("prompt") ?? null;
  if (purpose === GENERATION_PURPOSE.LISTING && !brief) throw new Error("A listing bake-off needs --prompt \"...\".");

  const ids = (flag("models") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const models = ids.map((id) => modelById(id) ?? id);
  const unknown = models.filter((m): m is string => typeof m === "string");
  if (ids.length === 0 || unknown.length > 0) {
    throw new Error(`Pass --models with registry ids${unknown.length ? `; unknown: ${unknown.join(", ")}` : ""}.`);
  }
  const ask = { references: 1, aspect: GENERATION_ASPECT.SQUARE, size: GENERATION_SIZE.S1K };
  const usable = (models as ModelEntry[]).filter((model) => canTake(model, ask));
  const skipped = (models as ModelEntry[]).filter((model) => !usable.includes(model));
  if (skipped.length) console.log(`Not configured or cannot take one square reference: ${skipped.map((m) => m.id).join(", ")}`);
  if (usable.length === 0) throw new Error("None of those models can run here.");

  const [org] = await adminOrgService.summariesFor([orgId]);
  if (!org) throw new Error(`No shop with id ${orgId}.`);
  const rate = await rateFor();
  if (!rate) throw new Error("No exchange rate could be fetched or found; costs cannot be shown in rupees.");

  const prompt =
    purpose === GENERATION_PURPOSE.SCENE
      ? scenePrompt(preset.prompt).text
      : withBrief("Product photograph of the product in the first reference image, unchanged.", brief);
  const assetIds = await newestPhotographs(orgId, limit);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(`Bake-off ${runId}: ${org.name} — ${assetIds.length} photograph(s) through ${usable.map((m) => m.id).join(", ")}.`);
  if (assetIds.length === 0) return;

  const segmenter = purpose === GENERATION_PURPOSE.SCENE ? segmenterFor() : null;
  const totals = new Map<string, number>(usable.map((m) => [m.id, 0]));
  const rows: Row[] = [];
  for (const assetId of assetIds) {
    const source = await mediaAssetService.readImageBytes(assetId);
    const subject = segmenter ? (await cutOutProduct(source, segmenter)).bytes : source.bytes;
    const reference = await sharp(subject)
      .rotate()
      .resize({ width: REFERENCE_LONG_EDGE, height: REFERENCE_LONG_EDGE, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const attempts: Attempt[] = [];
    for (const model of usable) {
      const startedAt = Date.now();
      const paise = microUsdToPaise(priceMicroUsd(model.price, 1, ask.aspect, ask.size), rate.paisePerUsd);
      try {
        const { image } = await routeCall([model], {
          prompt,
          references: [{ bytes: reference, mimeType: "image/png", assetId }],
          aspect: ask.aspect,
          size: ask.size,
        });
        const key = `${BAKEOFF_PREFIX}${runId}/${assetId}-${model.id.replace(/\//g, "_")}.png`;
        totals.set(model.id, (totals.get(model.id) ?? 0) + paise);
        attempts.push({ model: model.id, url: await mediaAssetService.putLooseObject(key, await sharp(image).png().toBuffer(), "image/png"), elapsedMs: Date.now() - startedAt, rupees: rupees(paise), error: null });
      } catch (error) {
        attempts.push({ model: model.id, url: null, elapsedMs: Date.now() - startedAt, rupees: "—", error: error instanceof Error ? error.message : String(error) });
      }
    }
    rows.push({ assetId, sourceUrl: mediaAssetService.publicUrlOf(source.objectKey), attempts });
    console.log(`  ${assetId}: ${attempts.map((a) => `${a.model} ${a.error ? "failed" : `${a.elapsedMs}ms`}`).join(", ")}`);
  }

  const url = await mediaAssetService.putLooseObject(
    `${BAKEOFF_PREFIX}${runId}/index.html`,
    Buffer.from(page(org.name, runId, prompt, rows, totals), "utf8"),
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

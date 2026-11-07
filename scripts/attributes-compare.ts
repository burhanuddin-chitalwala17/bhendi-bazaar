// The release gate of listing-model/attributes (D9, A3, parent Q33): every product's answers before the move
// against its value rows after it, by count and value, per type, in batches of 1,000. Read-only. Exits
// non-zero on any mismatch: the release stops.
//   npx tsx --env-file=.env.prod scripts/attributes-compare.ts
import "dotenv/config";

import { compareProduct, type Mismatch } from "@server/listing/attribute-compare";
import { prisma } from "@server/shared/prisma";

const BATCH = 1000;

async function main() {
  const types = new Map((await prisma.productType.findMany({ select: { key: true, measures: true } })).map((t) => [
    t.key,
    Object.fromEntries((Array.isArray(t.measures) ? (t.measures as Array<{ key?: string; unit?: string }>) : []).flatMap((m) => (m.key && m.unit ? [[m.key, m.unit]] : []))),
  ]));
  const perType = new Map<string, { products: number; answers: number; mismatches: number }>();
  const mismatches: Mismatch[] = [];
  let cursor: string | undefined;
  for (;;) {
    const products = await prisma.product.findMany({
      take: BATCH, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" },
      select: { id: true, productType: true, facts: true, measurements: true, weight: true, productValues: { select: { attributeKey: true, optionKey: true, text: true, number: true, bool: true } } },
    });
    if (products.length === 0) break;
    for (const p of products) {
      const result = compareProduct({ ...p, measureUnits: types.get(p.productType ?? "") ?? {} }, p.productValues.map((r) => ({ ...r, number: r.number === null ? null : r.number.toString() })));
      const t = perType.get(p.productType ?? "(none)") ?? { products: 0, answers: 0, mismatches: 0 };
      t.products++; t.answers += result.answers; t.mismatches += result.mismatches.length;
      perType.set(p.productType ?? "(none)", t);
      mismatches.push(...result.mismatches);
    }
    cursor = products.at(-1)!.id;
  }
  for (const [type, t] of [...perType].sort()) console.log(`${type}: ${t.products} products, ${t.answers} answers, ${t.mismatches} mismatches`);
  for (const m of mismatches.slice(0, 100)) console.log(`  ✗ ${m.productId} ${m.key}: was ${m.before}, now ${m.after ?? "missing"}`);
  console.log(mismatches.length === 0 ? "\nPASS: every answer moved." : `\nFAIL: ${mismatches.length} answers differ. Stop the release (parent Q33).`);
  await prisma.$disconnect();
  process.exit(mismatches.length === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});

// The field maps' proof run before release (listing-model/field-maps R7, A5, Q5): one real product of every
// Amazon type a BB type publishes to through Amazon's check-only mode, and every Google and Meta feed item
// against those channels' published rules. Read-only: check-only creates nothing; the feed is only built.
//   npx tsx --env-file=.env.prod scripts/field-maps-proof.ts [--amazon-only | --feeds-only]
// Prints field names and Amazon's own sentences, never a token. Exits non-zero on any refusal.
import "dotenv/config";

import { CONNECTION_STATE } from "@server/channels/channel-connection.types";
import { listingCreateService } from "@server/channels/listing-create.service";
import { CHANNEL } from "@server/shared/channels";
import { prisma } from "@server/shared/prisma";
import { checkFeed } from "@server/listing/shopfront-feed-check";

const flag = process.argv[2];
let failed = 0;

async function amazon() {
  const maps = await prisma.channelCategoryMap.findMany({
    where: { channel: CHANNEL.AMAZON, publishes: true, notSold: false, theirCategory: { not: null } },
    select: { productType: true, kind: true, theirCategory: true },
  });
  const connected = await prisma.channelConnection.findMany({ where: { channel: CHANNEL.AMAZON, state: CONNECTION_STATE.CONNECTED }, select: { orgId: true } });
  const orgIds = connected.map((c) => c.orgId);
  const seen = new Set<string>();
  for (const map of maps) {
    const type = map.theirCategory!;
    if (seen.has(type)) continue;
    const product = await prisma.product.findFirst({
      where: { orgId: { in: orgIds }, archivedAt: null, productType: map.productType, ...(map.kind ? { kind: map.kind } : {}) },
      select: { id: true, orgId: true, name: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!product) continue;
    seen.add(type);
    const { issues, gaps } = await listingCreateService.checkOnly(product.orgId, product.id, CHANNEL.AMAZON, type);
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) failed++;
    console.log(`\nAmazon ${type} — ${product.name} (${product.id}): ${errors.length === 0 ? "PASS" : `REFUSED, ${errors.length} errors`}`);
    for (const e of errors) console.log(`  ✗ ${e.attribute ?? "-"}: ${e.message}`);
    for (const g of gaps) console.log(`  · gap ${g.field} (${g.reason}${g.answer ? `: ${g.answer}` : ""})`);
  }
  console.log(`\nAmazon: ${seen.size} types checked.`);
}

async function feeds() {
  // The feed is empty while crawlers are blocked; the proof builds it as if launched.
  process.env.BLOCK_CRAWLERS = "0";
  const { shopfrontFeedXml } = await import("@/data-access-layer/shopfront-feed.dal");
  for (const channel of [CHANNEL.GOOGLE, CHANNEL.META] as const) {
    const items = checkFeed(channel, await shopfrontFeedXml(channel));
    const bad = items.filter((i) => i.problems.length > 0);
    if (bad.length > 0) failed++;
    console.log(`\n${channel}: ${items.length} items, ${bad.length} with problems`);
    for (const i of bad.slice(0, 50)) console.log(`  ✗ ${i.id} [${i.category ?? "no category"}]: ${i.problems.join("; ")}`);
  }
}

async function main() {
  if (flag !== "--feeds-only") await amazon();
  if (flag !== "--amazon-only") await feeds();
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});

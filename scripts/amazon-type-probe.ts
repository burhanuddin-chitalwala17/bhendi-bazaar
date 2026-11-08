// What an Amazon type requires of one standalone new listing on amazon.in, as the catalogue will store it
// (listing-model/channel-catalogue Q3). Run where the production connection is, then compare with a refusal:
//   npx tsx --env-file=.env.probe scripts/amazon-type-probe.ts HANDBAG [--save]
// Read-only on Amazon, through the home brand's connection; prints field names, never the token. The one
// database write is a token renewal through the worker's locked path. --save writes the schema to
// tests/fixtures/amazon/<TYPE>.schema.json so the evaluator can be tested against the real thing.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { channelConnectionRepository } from "@server/channels/channel-connection.repository";
import { channelConnectionService } from "@server/channels/channel-connection.service";
import { amazonCatalogueType } from "@server/channels/providers/amazon/amazon.publish";
import { CHANNEL } from "@server/shared/channels";
import { homeBrandOrgId } from "@server/shared/home-brand";
import { prisma } from "@server/shared/prisma";

const [type, flag] = process.argv.slice(2);

async function main() {
  if (!type) throw new Error("Usage: npx tsx --env-file=.env.probe scripts/amazon-type-probe.ts <PRODUCT_TYPE> [--save]");
  const orgId = homeBrandOrgId();
  if (!orgId) throw new Error("HOME_BRAND_ORG_ID is not set");
  const connection = await channelConnectionRepository.find(orgId, CHANNEL.AMAZON);
  if (!connection) throw new Error(`No Amazon connection for the home brand (${orgId})`);
  console.log(`Connection ${connection.id}: state ${connection.state}`);

  const read = await amazonCatalogueType(() => channelConnectionService.accessToken(connection.id), type);
  if (!read) throw new Error(`Amazon has no product type ${type}`);
  const by = (requirement: string, adapter: boolean) =>
    read.fields.filter((f) => f.requirement === requirement && f.adapterFills === adapter).map((f) => `${f.key} (${f.label})`);

  console.log(`\n${type} — schema ${read.schemaVersion ?? "unversioned"}, ${read.fields.length} fields`);
  console.log(`\nAsked of the shop, required (${by("required", false).length}):\n  ${by("required", false).join("\n  ")}`);
  console.log(`\nFilled by the adapter, required (${by("required", true).length}):\n  ${by("required", true).join("\n  ")}`);
  console.log(`\nConditional (${by("conditional", false).length + by("conditional", true).length}):\n  ${[...by("conditional", false), ...by("conditional", true)].join("\n  ")}`);

  if (flag === "--save") {
    const dir = new URL("../tests/fixtures/amazon/", import.meta.url);
    mkdirSync(dir, { recursive: true });
    const file = new URL(`${type}.schema.json`, dir);
    writeFileSync(file, `${JSON.stringify(read.schema, null, 2)}\n`);
    console.log(`\nSaved ${file.pathname}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

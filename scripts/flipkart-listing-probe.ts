// Which of Flipkart's listing calls our connection may use (channel-import: the 404 of 2026-10-21).
//   npx tsx --env-file=.env.probe scripts/flipkart-listing-probe.ts <orgId> [sku]
// Read-only on Flipkart. Prints each call's HTTP status and the names of its top-level fields; never
// the token, and an error body only truncated. The one database write is a token renewal, through
// the same locked path the worker uses, if the stored access token is about to lapse.
import "dotenv/config";
import { channelConnectionRepository } from "@server/channels/channel-connection.repository";
import { channelConnectionService } from "@server/channels/channel-connection.service";
import { CHANNEL } from "@server/shared/channels";
import { prisma } from "@server/shared/prisma";

const HOST = "https://api.flipkart.net/sellers";
const [orgId, givenSku] = process.argv.slice(2);

/** Field names and list sizes, never values: enough to see the shape a call answers with. */
function shape(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return typeof body;
  return Object.entries(body as Record<string, unknown>)
    .map(([key, value]) => (Array.isArray(value) ? `${key}[${value.length}]` : key))
    .join(", ");
}

/** An error body, shortened, with anything shaped like a token blanked. */
const redact = (text: string) => text.replace(/[A-Za-z0-9._~+/=-]{40,}/g, "<redacted>").slice(0, 300);

async function probe(token: string, label: string, method: "GET" | "POST", path: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`${HOST}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.log(`${label.padEnd(28)} no answer (${error instanceof Error ? error.name : "error"})`);
    return null;
  }
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON: an HTML error page from the gateway, usually.
  }
  if (response.ok) {
    console.log(`${label.padEnd(28)} HTTP ${response.status}  fields: ${shape(parsed)}`);
  } else {
    console.log(`${label.padEnd(28)} HTTP ${response.status}  body: ${redact(text)}`);
  }
  return response.ok ? parsed : null;
}

async function main() {
  if (!orgId) throw new Error("Usage: npx tsx --env-file=.env.probe scripts/flipkart-listing-probe.ts <orgId> [sku]");
  const connection = await channelConnectionRepository.find(orgId, CHANNEL.FLIPKART);
  if (!connection) throw new Error(`No Flipkart connection for org ${orgId}`);
  console.log(`Connection ${connection.id}: state ${connection.state}, read ${connection.readState ?? "never"} (${connection.readErrorCode ?? "no error"})`);
  const token = await channelConnectionService.accessToken(connection.id);
  console.log("Access token: obtained (not shown)\n");

  const products = await probe(token, "1. product/search", "POST", "/listings/v3/product/search", { batchNo: 0, internalState: "ACTIVE" });
  if (products && typeof products === "object") {
    const list = (products as { listingData?: Array<Record<string, unknown>> }).listingData ?? [];
    console.log(`${"".padEnd(28)} sellerId present: ${list.some((item) => typeof item.sellerId === "string") ? "yes" : "no"}`);
  }

  const search = await probe(token, "2. listings/v3/search", "POST", "/listings/v3/search", { filters: {}, page_id: null });
  const firstSku =
    givenSku ??
    (search as { listings?: Array<{ sku_id?: string }> } | null)?.listings?.find((item) => item.sku_id)?.sku_id ??
    null;

  if (firstSku) {
    await probe(token, "3. listings/v3/details", "POST", "/listings/v3/details", { sku_ids: [firstSku] });
    await probe(token, "4. GET listings/v3/{sku}", "GET", `/listings/v3/${encodeURIComponent(firstSku)}`);
  } else {
    console.log("3, 4: skipped. No SKU to try; pass one of yours as the second argument.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

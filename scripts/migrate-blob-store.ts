/**
 * Move every image from one Vercel Blob store to another, then repoint the database.
 *
 * Two phases, run separately, each resumable:
 *
 *   npx tsx scripts/migrate-blob-store.ts copy               # dry-run: what would move
 *   npx tsx scripts/migrate-blob-store.ts copy --apply       # download from old, upload to new
 *   npx tsx scripts/migrate-blob-store.ts rewrite            # dry-run: what would change
 *   npx tsx scripts/migrate-blob-store.ts rewrite --apply    # repoint every URL column
 *   npx tsx scripts/migrate-blob-store.ts check              # what still points at the old store
 *
 * Tokens: OLD_BLOB_READ_WRITE_TOKEN (source) and BLOB_READ_WRITE_TOKEN (destination — the
 * same variable the app reads, so a successful migration ends with the app already
 * pointed at the new store).
 *
 * The copy phase downloads every blob, which is Blob Data Transfer on the OLD store. If
 * that store is over its allowance the downloads return 403 and nothing can be exported
 * until the window resets — the script says so rather than writing a half-migration.
 *
 * Pathnames are preserved exactly, so only the hostname changes. That is what makes the
 * rewrite a host swap rather than a lookup, and what makes both phases idempotent.
 */

// tsx does not read .env on its own, unlike Prisma's tooling.
import "dotenv/config";
import { list, put } from "@vercel/blob";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
// The app's own client, so this reaches the database through the same pooled adapter
// the rest of the project does rather than standing up a second configuration.
import { prisma } from "../server/shared/prisma";

const MANIFEST_DIR = ".blob-migration";
const MANIFEST = `${MANIFEST_DIR}/manifest.jsonl`;

/** Every column that can hold a Blob URL, and how to reach it. */
const URL_COLUMNS = [
  { model: "category", column: "heroImage" },
  { model: "product", column: "thumbnail" },
  // Only IMAGE rows hold a URL here; a YOUTUBE row holds a bare video id (ADR-0017).
  // Matching on the old host rather than on `kind` covers that without a join.
  { model: "productMedia", column: "ref" },
  { model: "profile", column: "profilePic" },
  { model: "org", column: "logoUrl" },
  // Deliberately included. This is a frozen snapshot of what was bought, but the
  // freeze protects it from the catalogue changing, not from its store being retired —
  // leaving it would 404 every historical order's images.
  { model: "orderItem", column: "thumbnail" },
  { model: "shippingProvider", column: "logoUrl" },
  { model: "banner", column: "imageUrl" },
] as const;

type Manifest = Map<string, string>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`✗ ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

function hostOf(url: string): string {
  return new URL(url).host;
}

function readManifest(): Manifest {
  const map: Manifest = new Map();
  if (!existsSync(MANIFEST)) return map;
  for (const line of readFileSync(MANIFEST, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const { from, to } = JSON.parse(line) as { from: string; to: string };
    map.set(from, to);
  }
  return map;
}

function recordCopied(from: string, to: string): void {
  if (!existsSync(MANIFEST_DIR)) mkdirSync(MANIFEST_DIR, { recursive: true });
  appendFileSync(MANIFEST, `${JSON.stringify({ from, to })}\n`);
}

/** Every blob in the source store, following the cursor. */
async function listAll(token: string) {
  const all: { url: string; pathname: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ token, cursor, limit: 1000 });
    all.push(...page.blobs.map((b) => ({ url: b.url, pathname: b.pathname, size: b.size })));
    cursor = page.cursor;
  } while (cursor);
  return all;
}

async function copy(apply: boolean): Promise<void> {
  const oldToken = requireEnv("OLD_BLOB_READ_WRITE_TOKEN");
  const newToken = requireEnv("BLOB_READ_WRITE_TOKEN");
  if (oldToken === newToken) {
    console.error("✗ OLD_BLOB_READ_WRITE_TOKEN and BLOB_READ_WRITE_TOKEN are the same store.");
    process.exit(1);
  }

  const blobs = await listAll(oldToken);
  const done = readManifest();
  const pending = blobs.filter((b) => !done.has(b.url));
  const bytes = pending.reduce((sum, b) => sum + b.size, 0);

  console.log(`Source store:   ${blobs.length ? hostOf(blobs[0].url) : "(empty)"}`);
  console.log(`Blobs:          ${blobs.length} total, ${done.size} already copied, ${pending.length} pending`);
  console.log(`To download:    ${(bytes / 1024 / 1024).toFixed(1)} MB — this is Blob Data Transfer on the OLD store\n`);

  if (!apply) {
    console.log("Dry run. Re-run with --apply to copy.");
    return;
  }

  let copied = 0;
  for (const blob of pending) {
    const response = await fetch(blob.url);
    if (response.status === 403) {
      console.error(
        `\n✗ 403 on ${blob.pathname}.\n` +
          "  The source store is over its Data Transfer allowance, so its own contents\n" +
          "  cannot be read. Nothing further can be exported until that window resets —\n" +
          `  ${copied} blob(s) copied so far are recorded in ${MANIFEST}, so re-running\n` +
          "  this command later resumes rather than restarting."
      );
      process.exit(1);
    }
    if (!response.ok) {
      console.error(`✗ ${response.status} on ${blob.pathname} — stopping.`);
      process.exit(1);
    }

    const body = Buffer.from(await response.arrayBuffer());
    // Same pathname, so the only difference between old and new URL is the host.
    const written = await put(blob.pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: response.headers.get("content-type") ?? undefined,
      token: newToken,
    });
    recordCopied(blob.url, written.url);
    copied += 1;
    if (copied % 25 === 0) console.log(`  ${copied}/${pending.length}…`);
  }
  console.log(`\n✓ Copied ${copied} blob(s). Now run: rewrite --apply`);
}

async function rewrite(apply: boolean): Promise<void> {
  const manifest = readManifest();
  if (manifest.size === 0) {
    console.error(`✗ ${MANIFEST} is empty — run the copy phase first.`);
    process.exit(1);
  }

  const oldHost = hostOf([...manifest.keys()][0]);
  const newHost = hostOf([...manifest.values()][0]);
  console.log(`Rewriting ${oldHost}  →  ${newHost}`);
  console.log(`Database:  ${new URL(requireEnv("DATABASE_URL")).host}\n`);

  let changed = 0;
  let unmapped = 0;
  for (const { model, column } of URL_COLUMNS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[model];
    const rows: { id: string; [key: string]: string | null }[] = await delegate.findMany({
      where: { [column]: { contains: oldHost } },
      select: { id: true, [column]: true },
    });

    for (const row of rows) {
      const current = row[column];
      if (!current) continue;
      const next = manifest.get(current);
      if (!next) {
        // In the database but not in the store: a blob deleted out from under a row, or
        // a copy that has not run yet. Never guessed at — a wrong URL is worse than a
        // stale one, because the stale one still says where it came from.
        console.warn(`  ! ${model}.${column} ${row.id} → no copy of ${current}`);
        unmapped += 1;
        continue;
      }
      if (apply) await delegate.update({ where: { id: row.id }, data: { [column]: next } });
      changed += 1;
    }
    if (rows.length) console.log(`  ${model}.${column}: ${rows.length} row(s)`);
  }

  console.log(
    `\n${apply ? "✓ Updated" : "Would update"} ${changed} value(s)` +
      (unmapped ? `, ${unmapped} with no copy in the new store` : "")
  );
  if (!apply) console.log("Dry run. Re-run with --apply to write.");
}

async function check(): Promise<void> {
  const manifest = readManifest();
  const oldHost = manifest.size ? hostOf([...manifest.keys()][0]) : null;
  if (!oldHost) {
    console.error(`✗ ${MANIFEST} is empty — nothing to check against.`);
    process.exit(1);
  }

  let remaining = 0;
  for (const { model, column } of URL_COLUMNS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count: number = await (prisma as any)[model].count({
      where: { [column]: { contains: oldHost } },
    });
    if (count) console.log(`  ${model}.${column}: ${count} still on ${oldHost}`);
    remaining += count;
  }
  console.log(remaining === 0 ? `\n✓ Nothing points at ${oldHost}.` : `\n${remaining} value(s) remain.`);
}

async function main(): Promise<void> {
  const [phase] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");

  if (phase === "copy") await copy(apply);
  else if (phase === "rewrite") await rewrite(apply);
  else if (phase === "check") await check();
  else {
    console.error("Usage: migrate-blob-store.ts <copy|rewrite|check> [--apply]");
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * A column drop is the one migration step the next migration cannot undo, and the generated
 * warning — "all the data in the column will be lost" — says it about every column, every
 * time, so nobody reads it. What it never says is whose data, and who decided it could go.
 *
 * `20261004085003` said so for `BiddingEvent` and not for `Product`: `sizes` and `colors`
 * went uncopied against their own TRD (variants D7), and the owner was asked afterwards.
 * So a migration that drops a column or a table now carries, in its own comments, a dated
 * statement that the data was confirmed disposable — the sentence a reader of the file
 * needs, in the file. Migrations that predate the rule are listed below, shrink-only.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MIGRATIONS = join(ROOT, "prisma/migrations");

/**
 * Dropping migrations written before the rule. Each predates it, which is the only reason
 * accepted here: a new drop says whose data goes or does not land. An entry whose migration
 * gains the statement, or stops dropping anything, must be removed.
 */
const PREDATES_RULE: Record<string, string> = {
  "20251227193136_convert_flags_to_string_array": "predates the rule (2026-10-05)",
  "20260112184924_add_provider_authentication": "predates the rule (2026-10-05)",
  "20260114214454_update_shipping_provider_schema": "predates the rule (2026-10-05)",
  "20260117115138_seller_added": "predates the rule (2026-10-05)",
  "20260203073134_add_shipments_and_order_fields": "predates the rule (2026-10-05)",
  "20260810220000_drop_legacy_stock_and_origin": "predates the rule (2026-10-05)",
  "20260813010000_drop_product_images": "predates the rule (2026-10-05)",
  "20260816020000_drop_product_sale_price": "predates the rule (2026-10-05)",
  "20260922090000_reviews_derived_rating": "predates the rule (2026-10-05)",
  "20260923090000_reviews_soft_state": "predates the rule (2026-10-05)",
  "20260926100000_worker_foundation": "predates the rule (2026-10-05)",
  "20260926120000_seller_profile_split": "predates the rule (2026-10-05)",
};

const DROP = /\bDROP\s+(COLUMN|TABLE)\b/i;
/** "confirmed … disposable", with a date within reach of it. */
const CONFIRMATION = /confirmed[\s\S]{0,240}?\b(disposable|safe to drop|nothing recorded is lost)\b/gi;
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;

/** The SQL alone, so a header that talks about dropping is not a drop. */
function statementsOf(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

/** The comments alone, so a statement has to be written for a reader, not hidden in a string. */
function commentsOf(sql: string): string {
  const block = [...sql.matchAll(/\/\*([\s\S]*?)\*\//g)].map((m) => m[1]);
  const line = [...sql.matchAll(/--(.*)$/gm)].map((m) => m[1]);
  return [...block, ...line].join("\n");
}

function dropsSomething(sql: string): boolean {
  return DROP.test(statementsOf(sql));
}

function saysWhoseDataGoes(sql: string): boolean {
  const comments = commentsOf(sql);
  for (const match of comments.matchAll(CONFIRMATION)) {
    // The date may sit before "confirmed", inside the sentence, or in brackets after it.
    const window = comments.slice(Math.max(0, match.index - 120), match.index + match[0].length + 40);
    if (DATE.test(window)) return true;
  }
  return false;
}

const migrations = readdirSync(MIGRATIONS)
  .filter((dir) => /^\d/.test(dir) && existsSync(join(MIGRATIONS, dir, "migration.sql")))
  .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8") }));
const dropping = migrations.filter((m) => dropsSomething(m.sql));

describe("a column is never dropped without saying whose data goes", () => {
  it("the scan reaches the files it claims to check", () => {
    expect(migrations.length).toBeGreaterThan(40);
    expect(dropping.length).toBeGreaterThanOrEqual(10);
  });

  it("every dropping migration states, with a date, that the data was confirmed disposable", () => {
    const offenders = dropping
      .filter((m) => !(m.name in PREDATES_RULE) && !saysWhoseDataGoes(m.sql))
      .map((m) => m.name);
    expect(
      offenders,
      "These drop a column or table and never say whose data goes. Add a comment to the file " +
        "naming who confirmed the data disposable and when — e.g. `the owner confirmed on " +
        "YYYY-MM-DD that … so nothing recorded is lost`:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("the list of migrations that predate the rule only shrinks", () => {
    for (const [name, reason] of Object.entries(PREDATES_RULE)) {
      expect(reason, `${name}: the only accepted reason is that it predates the rule`).toMatch(/predates the rule \(\d{4}-\d{2}-\d{2}\)/);
      const migration = dropping.find((m) => m.name === name);
      expect(migration, `${name} no longer exists or drops nothing; remove it from PREDATES_RULE`).toBeDefined();
      expect(saysWhoseDataGoes(migration!.sql), `${name} now states it; remove it from PREDATES_RULE`).toBe(false);
    }
  });

  it("would catch a drop with no statement, and a statement with no date", () => {
    const drop = 'ALTER TABLE "Product" DROP COLUMN "sizes";';
    expect(dropsSomething(drop)).toBe(true);
    expect(dropsSomething("-- we may DROP COLUMN later\nSELECT 1;")).toBe(false);

    expect(saysWhoseDataGoes(`-- The owner confirmed on 2026-10-05 that nothing reads it, so nothing recorded is lost.\n${drop}`)).toBe(true);
    expect(saysWhoseDataGoes(`-- Confirmed safe to drop (2026-10-05).\n${drop}`)).toBe(true);
    expect(saysWhoseDataGoes(`-- The owner confirmed that nothing reads it, so nothing recorded is lost.\n${drop}`)).toBe(false);
    expect(saysWhoseDataGoes(`-- Reviewed on 2026-10-05.\n${drop}`)).toBe(false);
    // In a string literal rather than a comment, it is not written for a reader.
    expect(saysWhoseDataGoes(`INSERT INTO "Note" VALUES ('confirmed 2026-10-05 disposable');\n${drop}`)).toBe(false);
  });
});

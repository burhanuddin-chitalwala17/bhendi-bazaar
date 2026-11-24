/**
 * A source file is read whole every time a session touches it, so its size is a per-read cost (ADR-0083).
 * New files stay under LIMIT; the files already over it are pinned and may only shrink — a ratchet whose
 * reason for each entry is the line it should split along (ADR-0056).
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const LIMIT_KB = 25;

/** path → ceiling in KB (its size when pinned, rounded up: room for a one-line fix, not a feature) and the split. */
const PINNED: Record<string, { kb: number; split: string }> = {
  "server/catalog/product.repository.ts": {
    kb: 53,
    split: "Admin writes in one file; split by command family — bulk import and bulk price/archive, facts (list/replace/compare), media linking, SKU and slug lookups.",
  },
  "src/components/product/product-media-manager.tsx": {
    kb: 38,
    split: "One component holding the grid, upload progress, previews and thumbnails; lift MediaThumb and the upload-progress state into their own component and hook (ADR-0048).",
  },
  "server/channels/channel-listing.repository.ts": {
    kb: 31,
    split: "Seen/link/settle commands, family hints, push queries and problem records are four callers of one table; split the reads by caller and keep the writes here.",
  },
  "server/catalog/media-asset.repository.ts": {
    kb: 29,
    split: "Upload lifecycle (pending, confirm, processing), library listing and tags, and retirement/renditions; split the read projections out first.",
  },
  "server/channels/listing-publish.service.ts": {
    kb: 28,
    split: "Review and publish of one product versus the bulk send and the daily check; the scheduled check is the natural second module.",
  },
  "server/channels/providers/amazon/amazon.publish.ts": {
    kb: 28,
    split: "The catalogue-type reads (type definition, required attributes, themes, search) are separate from building and sending a listing; move them to amazon.catalogue.ts.",
  },
  "server/catalog/media-asset.service.ts": {
    kb: 27,
    split: "Uploads and sweeps, the library and tags, and the loose-object/derived-bytes storage seam; the storage seam is the cleanest first cut.",
  },
  "server/channels/channel-family.service.ts": {
    kb: 27,
    split: "Reading and paging marketplace families versus settling them into products; settle is the write path and can stand alone.",
  },
  "server/channels/channel-facts.service.ts": {
    kb: 26,
    split: "Planning and queueing fills versus reading and settling a marketplace's answers versus the cards the UI shows; the cards are a read model of their own.",
  },
  "server/catalog/product.read.repository.ts": {
    kb: 26,
    split: "Storefront reads (by slug, similar, hero, offers, search) versus the reads other domains call (checkout, stock, pricing, channel feed); the second set is a public surface.",
  },
  "server/catalog/storefront.service.ts": {
    kb: 26,
    split: "The storefront page and its settings versus banner management (list, add, edit, remove, reorder); banners can be their own service.",
  },
};

const sources = () =>
  execFileSync("git", ["ls-files", "src", "server", "worker"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|tsx)$/.test(f) && existsSync(join(ROOT, f)));

const kbOf = (f: string) => statSync(join(ROOT, f)).size / 1024;

describe("source file size", () => {
  it(`no unpinned source file is over ${LIMIT_KB} KB`, () => {
    const over = sources()
      .filter((f) => !(f in PINNED) && kbOf(f) > LIMIT_KB)
      .map((f) => `${f} is ${kbOf(f).toFixed(1)} KB`);
    expect(over, "Split it along a seam before it grows further; pinning a new file needs an argument in review (ADR-0056 D5)").toEqual([]);
  });

  it("a pinned file only shrinks", () => {
    const grew = Object.entries(PINNED)
      .filter(([f, { kb }]) => existsSync(join(ROOT, f)) && kbOf(f) > kb)
      .map(([f, { kb }]) => `${f} is ${kbOf(f).toFixed(1)} KB, pinned at ${kb}`);
    expect(grew, "Take the room from the split its entry names, not from the ceiling").toEqual([]);
  });

  it("a pinned ceiling follows the file down", () => {
    const slack = Object.entries(PINNED)
      .filter(([f, { kb }]) => existsSync(join(ROOT, f)) && kb > Math.ceil(kbOf(f)))
      .map(([f, { kb }]) => `${f}: lower kb ${kb} → ${Math.ceil(kbOf(f))}`);
    expect(slack, "A file that shrank keeps its room only until the next commit; otherwise it can grow back unflagged").toEqual([]);
  });

  it("an entry leaves the list once its file is under the limit or gone", () => {
    const stale = Object.keys(PINNED).filter((f) => !existsSync(join(ROOT, f)) || kbOf(f) <= LIMIT_KB);
    expect(stale, "Remove these entries — the list is the backlog and must not go stale").toEqual([]);
  });

  it("every entry says where the file splits", () => {
    const shrugs = Object.entries(PINNED).filter(([, { split }]) => split.length < 60).map(([f]) => f);
    expect(shrugs).toEqual([]);
  });
});

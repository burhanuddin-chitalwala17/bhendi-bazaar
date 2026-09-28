/**
 * The backfill reads one database and one bucket, and nothing downstream notices when they are
 * not a pair. Dimensions arrive over plain HTTP from the stored URL, so a record is still
 * written and still looks right — complete but for `objectKey`, which is the field crop,
 * improve and the deletion sweep all read. The run is idempotent on the reference, so the
 * corrected second run skips every asset the first made and the null is permanent.
 *
 * These pin the decision that stops it: a write refuses when nothing in the library belongs to
 * the configured store, and only then.
 */
import { describe, expect, it } from "vitest";
import { refusesForeignLibrary } from "@server/catalog/media-backfill";

/** Stands in for `pathnameFor`: ours if it sits under the base, else not ours. */
const under = (base: string) => (url: string) => (url.startsWith(`${base}/`) ? url.slice(base.length + 1) : null);

const OURS = "https://images.example.com";
const THEIRS = "https://images.dev.example.com";

describe("a backfill refuses a database that belongs to another store", () => {
  it("refuses when not one reference is ours", () => {
    const refs = [`${THEIRS}/a.jpg`, `${THEIRS}/b.jpg`, `${THEIRS}/c.jpg`];
    expect(refusesForeignLibrary(refs, under(OURS))).toBe(true);
  });

  it("allows it on a single recognised reference, because one pair is the whole question", () => {
    // A store legitimately holds external URLs beside its own — a seeded placeholder, a
    // supplier's image. One of ours is proof the environment is pointed the right way.
    const refs = [`${THEIRS}/a.jpg`, "https://placehold.co/600", `${OURS}/mine.jpg`];
    expect(refusesForeignLibrary(refs, under(OURS))).toBe(false);
  });

  it("says nothing about an empty library", () => {
    // A database with no images to bring across is not evidence of a mismatch, and refusing
    // here would block the first run on a new environment, which is when it is most wanted.
    expect(refusesForeignLibrary([], under(OURS))).toBe(false);
  });

  it("treats an unconfigured store as recognising nothing, so a write still stops", () => {
    // `pathnameFor` throws without R2_PUBLIC_BASE_URL and the caller maps that to "not ours".
    const refs = [`${OURS}/a.jpg`];
    expect(refusesForeignLibrary(refs, () => null)).toBe(true);
  });
});

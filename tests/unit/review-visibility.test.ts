/**
 * Every buyer-facing review read goes through one predicate (ADR-0032, R6, R16a).
 *
 * A census rather than a behaviour test, in the shape ADR-0029's visibility test already
 * established for products. Reviews are now hidden for two unrelated reasons — the
 * platform withdrew it, or its author retracted it — and the failure mode is not a crash
 * but a read that remembers one and forgets the other, quietly showing words somebody
 * took down. Filtering by hand is how that happens, so it is the thing under test.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(join(ROOT, path), "utf8");

const REPOSITORY = "server/catalog/review.repository.ts";

describe("the visible-review predicate", () => {
  it("is declared exactly once, and exported", () => {
    const text = source(REPOSITORY);
    expect(text.match(/export const VISIBLE_REVIEW_WHERE/g)).toHaveLength(1);
    // Both reasons, or it is not the predicate this test is protecting.
    const declaration = text.slice(text.indexOf("export const VISIBLE_REVIEW_WHERE"));
    const body = declaration.slice(0, declaration.indexOf("} as const"));
    expect(body).toContain("withdrawnAt: null");
    expect(body).toContain("deletedAt: null");
  });

  it("is what the buyer-facing reads use, rather than a hand-written filter", () => {
    const text = source(REPOSITORY);
    // The brand page's two org-wide reads (brand-page A3a) are buyer-facing too.
    for (const method of [
      "publishedRatingRows",
      "listPublished",
      "publishedRatingRowsForOrg",
      "listPublishedForOrg",
    ]) {
      const start = text.indexOf(`async ${method}(`);
      expect(start, `${method} not found`).toBeGreaterThan(-1);
      const body = text.slice(start, start + 900);
      expect(
        body,
        `${method} must spread VISIBLE_REVIEW_WHERE, not spell the filter itself`,
      ).toContain("...VISIBLE_REVIEW_WHERE");
    }
  });

  it("leaves no `isApproved` anywhere in the review aggregate", () => {
    // The column is gone. A surviving reference is a read that silently matches nothing,
    // or prose telling an org a withdrawn review is "awaiting moderation" (it did).
    for (const path of [
      REPOSITORY,
      "server/catalog/review.service.ts",
      "server/catalog/review.types.ts",
      "src/data-access-layer/org/reviews.dal.ts",
      "src/app/(admin)/admin/reviews/page.tsx",
      "src/app/(org)/org/[orgId]/reviews/page.tsx",
      "src/components/product/console/reviews/adminReviewApiClient.ts",
    ]) {
      expect(source(path), `${path} still mentions isApproved`).not.toMatch(
        /isApproved/,
      );
    }
  });

  it("has no path that destroys a review", () => {
    // `deleteMany`/`delete` on the review model would defeat ADR-0032 silently: the row
    // simply stops existing and no surface reports anything different.
    const text = source(REPOSITORY);
    expect(text).not.toMatch(/prisma\.review\.delete\b/);
    expect(text).not.toMatch(/prisma\.review\.deleteMany\b/);
    expect(source("server/catalog/review.service.ts")).not.toMatch(
      /deleteReview/,
    );
  });

  it("scopes the author's own writes by author *and* by not-already-retracted", () => {
    const text = source(REPOSITORY);
    for (const method of ["updateOwn", "softDeleteOwn"]) {
      const start = text.indexOf(`async ${method}(`);
      const body = text.slice(start, start + 700);
      expect(body, `${method} must scope by userId`).toMatch(/userId/);
      expect(
        body,
        `${method} must refuse a review its author already retracted`,
      ).toMatch(/deletedAt: null/);
    }
  });
});

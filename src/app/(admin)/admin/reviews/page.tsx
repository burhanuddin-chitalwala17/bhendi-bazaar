/**
 * The moderation queue (product-reviews R15, R16) — a server component ([ADR-0034]).
 *
 * Two jobs the old table could not do. It could not *show* a review — the comment was clamped to
 * two lines with no way to open one, so moderating meant judging words you could not read; a row
 * now opens a detail panel with the whole review and its photographs at a size they can be judged
 * at. And it could not tell the three states apart, because there was one boolean: a review is
 * published, withdrawn by the platform, or retracted by its author, and only the first two are
 * ours to change (ADR-0032).
 *
 * Filters live in the URL so the server can answer them; the client leaves are the filter bar and
 * the table with its dialog and withdraw action.
 */
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { adminReviewsDAL } from "@/data-access-layer/admin/reviews.dal";
import { ReviewsFilters } from "@/components/product/console/reviews/ReviewsFilters";
import { ReviewsTable } from "@/components/product/console/reviews/ReviewsTable";
import { REVIEW_STATES, STAR_VALUES } from "@server/catalog/review.types";
import {
  DEFAULT_PAGE_SIZE,
  resolvePageNumber,
  resolvePageSize,
  resolveSortBy,
  resolveSortOrder,
} from "@server/shared/pagination";
import { ADMIN_REVIEWS_COPY } from "./reviews-copy";

/** The columns this listing may be ordered by — the same set `ReviewListFilters` declares. */
const SORTABLE = ["createdAt", "rating"] as const;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = resolvePageNumber(one("page"));
  const limit = resolvePageSize(one("limit"), DEFAULT_PAGE_SIZE);

  // Every value from the query string is resolved against a closed set rather than cast into
  // one (Invariant 4) — including the rating, which is a star value or nothing.
  const state = REVIEW_STATES.find((candidate) => candidate === one("state"));
  const isVerified = one("isVerified");
  const minRating = STAR_VALUES.find((star) => String(star) === one("minRating"));

  const { reviews, total, totalPages } = await adminReviewsDAL.list({
    search: one("search") || undefined,
    state,
    isVerified: isVerified === "true" ? true : isVerified === "false" ? false : undefined,
    minRating,
    page,
    limit,
    sortBy: resolveSortBy(one("sortBy"), SORTABLE, "createdAt"),
    sortOrder: resolveSortOrder(one("sortOrder")),
  });

  return (
    <PageShell width="wide">
      <PageHeader
        title={ADMIN_REVIEWS_COPY.title}
        description={ADMIN_REVIEWS_COPY.description}
      />

      <ReviewsFilters />

      <ReviewsTable
        reviews={reviews}
        page={page}
        pageSize={limit}
        totalPages={totalPages}
        total={total}
      />
    </PageShell>
  );
}

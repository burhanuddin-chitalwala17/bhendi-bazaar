"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { REVIEW_STATES, type ReviewState } from "@server/catalog/review.types";
import { PRODUCT_CONSOLE_COPY } from "../console-copy";
import { REVIEW_STATE_COPY } from "@/components/product/console/console-copy";

/**
 * How each state reads to a moderator. Keyed by the union rather than restated as a
 * list, so a fourth state cannot be added without the compiler asking what to call it.
 */
const STATE_LABELS: Record<ReviewState, string> = {
  published: REVIEW_STATE_COPY.published,
  withdrawn: REVIEW_STATE_COPY.withdrawn,
  deleted: REVIEW_STATE_COPY.deleted,
};

const RATINGS = [5, 4, 3, 2, 1] as const;

/** Held in the URL so the server can answer ([ADR-0034]). */
export function ReviewsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply({ search })}
          placeholder={PRODUCT_CONSOLE_COPY.reviews.searchPlaceholder}
        />
        <Button variant="default" onClick={() => apply({ search })} className="flex items-center gap-2">
          <Icon name="search" />
          {PRODUCT_CONSOLE_COPY.reviews.search}
        </Button>
      </div>

      <Select value={params.get("state") ?? ""} onChange={(e) => apply({ state: e.target.value })}>
        <option value="">{PRODUCT_CONSOLE_COPY.reviews.allReviews}</option>
        {REVIEW_STATES.map((state) => (
          <option key={state} value={state}>
            {STATE_LABELS[state]}
          </option>
        ))}
      </Select>

      <Select
        value={params.get("isVerified") ?? ""}
        onChange={(e) => apply({ isVerified: e.target.value })}
      >
        <option value="">{PRODUCT_CONSOLE_COPY.reviews.allTypes}</option>
        <option value="true">{PRODUCT_CONSOLE_COPY.reviews.verified}</option>
        <option value="false">{PRODUCT_CONSOLE_COPY.reviews.notVerified}</option>
      </Select>

      <Select
        value={params.get("minRating") ?? ""}
        onChange={(e) => apply({ minRating: e.target.value })}
      >
        <option value="">{PRODUCT_CONSOLE_COPY.reviews.allRatings}</option>
        {RATINGS.map((rating) => (
          <option key={rating} value={rating}>
            {PRODUCT_CONSOLE_COPY.reviews.stars(rating)}
          </option>
        ))}
      </Select>
    </div>
  );
}

import type { BrandPage } from "@/data-access-layer/storefront.dal";
import {
  BRAND_PAGE_SECTION_ORDER,
  brandPageSections,
  type BrandPageSection,
} from "./sections";
import { HIDEABLE_BRAND_PAGE_SECTIONS } from "@server/catalog/brand-page-sections";
import { BRAND_PAGE_COPY } from "./brand-page-copy";
import { ROUTES } from "@server/shared/routes";
import { STANDING_LABEL_COPY } from "@/components/storefront/brand-page/brand-page-copy";

/**
 * What a shop's own page currently shows, and what each missing section is waiting for
 * (brand-page D11).
 *
 * The list is not a second opinion about emptiness. `brandPageSections` decides what a buyer
 * sees, and this runs the same function over the shop's own payload, so a section can never
 * be promised here and absent there. All this file adds is a name for the section and a name
 * for the one fact that would turn it on — which is the part a shop cannot infer from a page
 * that correctly shows nothing.
 */

export type SectionStanding = "showing" | "hidden" | "waiting";

export interface BrandPageSectionStatus {
  section: BrandPageSection;
  /** What a shop calls this part of its page, not what the code calls it. */
  label: string;
  standing: SectionStanding;
  /** What is missing, in the shop's words. Absent once the section is showing. */
  waitingFor?: string;
  /** Where to go and supply it. Absent when the fact is not something a form collects. */
  href?: string;
}

/** Named here because a shop reads these, and the keys are for the code. */
const LABELS: Record<BrandPageSection, string> = {
  hero: STANDING_LABEL_COPY.hero,
  story: STANDING_LABEL_COPY.story,
  categories: STANDING_LABEL_COPY.categories,
  brands: STANDING_LABEL_COPY.brands,
  buyersSay: STANDING_LABEL_COPY.buyersSay,
  newest: STANDING_LABEL_COPY.newest,
  policies: STANDING_LABEL_COPY.policies,
  social: STANDING_LABEL_COPY.social,
};

/**
 * The one fact each section is waiting for. A section whose fact is a field says where the
 * field is; one that waits on the world — a second brand, enough reviews — says so and sends
 * the shop nowhere, because there is no form that would fix it.
 */
const WAITING: Partial<Record<BrandPageSection, { fact: string; to?: (orgId: string) => string }>> = {
  story: {
    fact: BRAND_PAGE_COPY.waiting.story,
    to: (orgId) => `${ROUTES.org.shopDetails(orgId)}#about`,
  },
  categories: {
    fact: BRAND_PAGE_COPY.waiting.categories,
    to: (orgId) => ROUTES.org.products(orgId),
  },
  brands: {
    fact: BRAND_PAGE_COPY.waiting.brands,
    to: (orgId) => ROUTES.org.listing(orgId),
  },
  buyersSay: { fact: BRAND_PAGE_COPY.waiting.buyersSay },
  policies: {
    fact: BRAND_PAGE_COPY.waiting.policies,
    to: (orgId) => `${ROUTES.org.shopDetails(orgId)}#promise`,
  },
  social: {
    fact: BRAND_PAGE_COPY.waiting.social,
    to: (orgId) => `${ROUTES.org.shopDetails(orgId)}#social`,
  },
};

const hideable: readonly string[] = HIDEABLE_BRAND_PAGE_SECTIONS;

/**
 * Every section in the platform's order with its standing. Hidden is reported before waiting:
 * a shop that switched a section off is not missing a fact, and telling it to write one would
 * be advice to undo a choice it just made.
 */
export function brandPageStanding(page: BrandPage, orgId: string): BrandPageSectionStatus[] {
  const showing = new Set<BrandPageSection>(brandPageSections(page));
  const hidden = new Set<string>(page.hiddenSections);

  return BRAND_PAGE_SECTION_ORDER.map((section) => {
    const label = LABELS[section];
    if (showing.has(section)) return { section, label, standing: "showing" as const };
    if (hideable.includes(section) && hidden.has(section)) {
      return { section, label, standing: "hidden" as const };
    }
    const waiting = WAITING[section];
    return {
      section,
      label,
      standing: "waiting" as const,
      waitingFor: waiting?.fact,
      href: waiting?.to?.(orgId),
    };
  });
}

/** For the dashboard's one-line summary: how much of the page is live. */
export function brandPageShowing(statuses: BrandPageSectionStatus[]): {
  showing: number;
  total: number;
} {
  return {
    showing: statuses.filter((status) => status.standing === "showing").length,
    total: statuses.length,
  };
}

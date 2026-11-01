import type { BrandPage } from "@/data-access-layer/storefront.dal";
import {
  BRAND_PAGE_SECTION_ORDER,
  brandPageSections,
  type BrandPageSection,
} from "./sections";
import { HIDEABLE_BRAND_PAGE_SECTIONS } from "@server/catalog/brand-page-sections";

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
  hero: "The top of the page",
  story: "About the shop",
  categories: "What you sell",
  brands: "Brands you carry",
  buyersSay: "What buyers say",
  newest: "Your newest goods",
  policies: "Delivery and returns",
  social: "Ways to follow you",
};

/**
 * The one fact each section is waiting for. A section whose fact is a field says where the
 * field is; one that waits on the world — a second brand, enough reviews — says so and sends
 * the shop nowhere, because there is no form that would fix it.
 */
const WAITING: Partial<Record<BrandPageSection, { fact: string; to?: (orgId: string) => string }>> = {
  story: {
    fact: "a few lines about the shop, or the name of the person behind it",
    to: (orgId) => `/org/${orgId}/shop/details#about`,
  },
  categories: {
    fact: "a product on sale, so there is a category to show",
    to: (orgId) => `/org/${orgId}/products`,
  },
  brands: {
    fact: "a second brand — one brand is not a range worth a section",
    to: (orgId) => `/org/${orgId}/listing`,
  },
  buyersSay: { fact: "enough published reviews to be worth quoting" },
  policies: {
    fact: "your delivery and returns promise",
    to: (orgId) => `/org/${orgId}/shop/details#promise`,
  },
  social: {
    fact: "a handle on one of the networks we link to",
    to: (orgId) => `/org/${orgId}/shop/details#social`,
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

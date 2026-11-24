import { FEATURE, type Feature } from "./feature-access.types";

/**
 * Every org route method and every paid job, classified (subscriptions/feature-access D9). A route
 * that needs a feature passes it to `withOrg`; `core` costs a reason sentence. A job names the
 * feature its shop must hold, or `core` with why. `tests/unit/feature-registry.test.ts` reads the
 * route tree and the job registry and fails anything unclassified, any entry with nothing behind
 * it, and a paid route whose `withOrg` does not carry its feature.
 */

type Classification = { readonly feature: Feature } | { readonly core: string };

const CH = { feature: FEATURE.CHANNELS } as const;
const ENH = { feature: FEATURE.IMAGE_ENHANCEMENT } as const;

const FREE = "Part of running a shop on Bhendi Bazaar, which stays free (feature-access Q2).";
const STOREFRONT_BUILD = "Building the storefront stays free so it is ready when switched on (Q18); only showing it is locked.";
const SCREEN_READ = "A read that draws a channel screen; screens open and show what is there, only actions lock (Q20).";
const SERVICE = "Mixes free and paid actions; the paid one refuses in its service (D5, D7).";

export const ORG_ROUTE_FEATURES: Record<string, Classification> = {
  "DELETE /api/org/[orgId]/bidding/[id]": { core: FREE },
  "GET /api/org/[orgId]/bidding/products": { core: FREE },
  "GET /api/org/[orgId]/bidding": { core: FREE },
  "POST /api/org/[orgId]/bidding": { core: FREE },
  "POST /api/org/[orgId]/brands/[brandId]/retire": { core: FREE },
  "PATCH /api/org/[orgId]/brands/[brandId]": { core: FREE },
  "POST /api/org/[orgId]/brands": { core: FREE },

  "GET /api/org/[orgId]/channels/[channel]/connect": CH,
  "POST /api/org/[orgId]/channels/[channel]/connection/check": CH,
  "DELETE /api/org/[orgId]/channels/[channel]/connection": {
    core: "Disconnecting is always allowed: a lock never traps a shop's marketplace credential.",
  },
  "POST /api/org/[orgId]/channels/[channel]/families/[familyId]": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/[id]/bring-back": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/[id]/facts": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/[id]/leave-off": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/[id]/link-back": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/[id]/photos/retry": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/[id]/request": {
    core: "Refused by platformListingService.complaint (D5); this route already reaches channels and requests.",
  },
  "POST /api/org/[orgId]/channels/[channel]/listings/[id]/unlink": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/dismiss-group": CH,
  "POST /api/org/[orgId]/channels/[channel]/listings/read": CH,
  "GET /api/org/[orgId]/channels/[channel]/listings/read": { core: SCREEN_READ },
  "PUT /api/org/[orgId]/channels/[channel]/locations": CH,
  "POST /api/org/[orgId]/channels/[channel]/publish": CH,
  "PUT /api/org/[orgId]/channels/[channel]/stock-sync": {
    core: "Pausing sync must always work; turning it on refuses in channelStockService.turnOn (D5).",
  },
  "POST /api/org/[orgId]/channels/family": CH,
  "PUT /api/org/[orgId]/channels": {
    core: "Turns Google or Meta on or off. Off is always allowed; on refuses in the handler from the scope (Q4, D7).",
  },
  "GET /api/org/[orgId]/channels/settle/products": { core: SCREEN_READ },
  "POST /api/org/[orgId]/channels/settle": CH,

  "POST /api/org/[orgId]/enhancements/[id]/accept": { core: "A proposal already made is the shop's (Q32)." },
  "POST /api/org/[orgId]/enhancements/[id]/discard": { core: "A proposal already made is the shop's (Q32)." },
  "GET /api/org/[orgId]/enhancements/[id]": { core: "Reading a proposal already made (Q12)." },
  "POST /api/org/[orgId]/enhancements": ENH,
  "POST /api/org/[orgId]/enhancements/styled": ENH,
  "GET /api/org/[orgId]/enhancements/styled/quote": ENH,

  "POST /api/org/[orgId]/families": { core: FREE },
  "PUT /api/org/[orgId]/listing-defaults": { core: FREE },
  "GET /api/org/[orgId]/listing-values": { core: FREE },
  "PATCH /api/org/[orgId]/locations/[locationId]": { core: FREE },
  "DELETE /api/org/[orgId]/locations/[locationId]": { core: FREE },
  "GET /api/org/[orgId]/locations": { core: FREE },
  "POST /api/org/[orgId]/locations": { core: FREE },
  "POST /api/org/[orgId]/media/[assetId]/crop": { core: FREE },
  "PUT /api/org/[orgId]/media/[assetId]/poster": { core: FREE },
  "PUT /api/org/[orgId]/media/[assetId]/tags": { core: FREE },
  "GET /api/org/[orgId]/credits": { core: FREE },
  "POST /api/org/[orgId]/media/[assetId]/retire": { core: FREE },
  "GET /api/org/[orgId]/media/[assetId]/download": { core: FREE },
  "HEAD /api/org/[orgId]/media/[assetId]/download": { core: FREE },
  "GET /api/org/[orgId]/media/[assetId]": { core: FREE },
  "GET /api/org/[orgId]/media": { core: FREE },
  "PATCH /api/org/[orgId]/products/[id]/archive": { core: FREE },
  "GET /api/org/[orgId]/products/[id]/listings/[channel]/pages": CH,
  "PUT /api/org/[orgId]/products/[id]/listings/[channel]": {
    core: "Saves a listing's own answers, which stay editable so it is ready when switched on (Q5, Q34); sending refuses.",
  },
  "POST /api/org/[orgId]/products/[id]/listings/[channel]": { core: SERVICE },
  "PATCH /api/org/[orgId]/products/[id]": { core: FREE },
  "DELETE /api/org/[orgId]/products/[id]": { core: FREE },
  "POST /api/org/[orgId]/products/bulk-edit": { core: SERVICE },
  "POST /api/org/[orgId]/products/bulk/marker": { core: FREE },
  "POST /api/org/[orgId]/products/bulk": { core: FREE },
  "GET /api/org/[orgId]/products/bulk/sample": { core: FREE },
  "POST /api/org/[orgId]/products/bulk/validate": { core: FREE },
  "PUT /api/org/[orgId]/products/facts": { core: FREE },
  "POST /api/org/[orgId]/products/readiness": {
    core: "Readiness advises on every channel whatever the plan (Q5, ADR-0053).",
  },
  "GET /api/org/[orgId]/products": { core: FREE },
  "POST /api/org/[orgId]/products": { core: FREE },
  "PATCH /api/org/[orgId]/promotions/[id]": { core: FREE },
  "DELETE /api/org/[orgId]/promotions/[id]": { core: FREE },
  "GET /api/org/[orgId]/promotions/products": { core: FREE },
  "GET /api/org/[orgId]/promotions": { core: FREE },
  "POST /api/org/[orgId]/promotions": { core: FREE },
  "POST /api/org/[orgId]/requests": { core: "An issue in the shop's own words stays free (Q19)." },
  "POST /api/org/[orgId]/setup/hidden": { core: FREE },
  "DELETE /api/org/[orgId]/setup/hidden": { core: FREE },
  "POST /api/org/[orgId]/setup/shared": { core: FREE },
  "POST /api/org/[orgId]/shipments/[id]/cancel": { core: FREE },
  "GET /api/org/[orgId]/shipments/[id]/label": { core: FREE },
  "POST /api/org/[orgId]/shipments/[id]/ready": { core: FREE },
  "PATCH /api/org/[orgId]/shop/contact": { core: FREE },
  "PATCH /api/org/[orgId]/shop/details": { core: FREE },
  "PATCH /api/org/[orgId]/storefront/banners/[bannerId]": { core: STOREFRONT_BUILD },
  "DELETE /api/org/[orgId]/storefront/banners/[bannerId]": { core: STOREFRONT_BUILD },
  "PATCH /api/org/[orgId]/storefront/banners/reorder": { core: STOREFRONT_BUILD },
  "GET /api/org/[orgId]/storefront/banners": { core: STOREFRONT_BUILD },
  "POST /api/org/[orgId]/storefront/banners": { core: STOREFRONT_BUILD },
  "PATCH /api/org/[orgId]/storefront/handle": { core: STOREFRONT_BUILD },
  "POST /api/org/[orgId]/storefront/look/revert": { core: STOREFRONT_BUILD },
  "PUT /api/org/[orgId]/storefront/look": { core: STOREFRONT_BUILD },
  "GET /api/org/[orgId]/storefront": { core: STOREFRONT_BUILD },
  "PATCH /api/org/[orgId]/storefront": { core: STOREFRONT_BUILD },
  "POST /api/org/[orgId]/upload/confirm": { core: FREE },
  "POST /api/org/[orgId]/upload": { core: FREE },
  "POST /api/org/[orgId]/upload/token": { core: FREE },
};

const SKIPS = "Ends succeeded with a skip for a shop without Channels (D8).";
const PASS = "A pass over many shops that reads the holders once and leaves the rest out (D8).";

/** Every job type the domains register, and what its shop must hold. */
export const JOB_FEATURES: Record<string, { readonly feature: Feature; readonly how: string } | { readonly core: string }> = {
  "channels.read-listings": { ...CH, how: SKIPS },
  "channels.copy-listing-photos": { ...CH, how: SKIPS },
  "channels.fill-facts": { ...CH, how: SKIPS },
  "channels.publish-listing": { ...CH, how: SKIPS },
  "channels.push-stock": { ...CH, how: "channelStockService.push sends nothing for a shop without Channels (D8, Q9)." },
  "channels.stock-changed": { ...CH, how: "Only queues pushes; each push checks its shop (D8)." },
  "channels.check-stock": { ...CH, how: PASS },
  "channels.check-orders": { ...CH, how: PASS },
  "channels.check-listings": { ...CH, how: "A locked shop's due look is recorded missed, never asked (D8)." },
  "channels.check-listing-problems": { ...CH, how: PASS },
  "channels.maintain": { ...CH, how: "Renews and re-seals every shop's tokens (Q11); health-checks only holders (D5)." },
  "image.enhance": { core: "Work already queued finishes after a lock (Q12); new work is refused at request." },
  "requests.listing-complaints": { core: "Raised only for holders: channels refuses the listing work that would complain (D5)." },
  "requests.daily": { core: "Its marketplace needs come from channelTypesService.connectedOrgs, which keeps holders only (D5)." },
  "requests.ticket-resolved": { core: "Tells the shop a ticket it already had is resolved." },
  "listing.refresh-completeness": { core: "Readiness advises on every channel whatever the plan (Q5)." },
  "media.sweep": { core: FREE },
  "media.transcode": { core: FREE },
  "notify.send": { core: FREE },
  "org.email-changed": { core: FREE },
  "payment.reconcile": { core: FREE },
  "fulfilment.sweep": { core: FREE },
  "ping": { core: "The worker's own health check." },
};

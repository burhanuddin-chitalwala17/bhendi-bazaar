# Spec — seller-profile

- **Summary:** An organisation's profile has a private face for what listing needs and a public face for what a buyer may see, and nothing is demanded before it is needed
- **Status:** 🔨 In progress — PR-151, PR-162, PR-175 (3 of 4)
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-27
- **References:** [trd.md](trd.md), [brand-page](brand-page/) (subfeature), [org-storefront](../org-storefront/) (seller-identity R5, storefront-branding, storefront-pages R3), [ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md), [ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

An organisation has one profile with two faces. The private face holds what the platform and the listing tools need to know about the seller: its brands, who makes and packs what it sells, where things come from, its tax codes. The public face is what a buyer may see and what the seller may advertise: its story, its location, its policies, its look. Onboarding fills both progressively, and nothing in either is ever demanded before the moment it is needed.

## Why

Every product a seller lists on any channel repeats the same facts about the seller: brand, manufacturer, origin, tax code. Today those are typed per product, per channel, and a marketplace listing is the sum of that retyping. Held once on the profile, they become the values a product inherits, so the second product in a range costs almost no typing. The same profile already feeds the storefront's about page; this feature makes the two halves explicit so a buyer-facing page can never carry a private fact, and a listing tool can never lack one it needs.

Resellers are the reason the private face is built around brands rather than the seller. A reseller carries twenty brands from twenty manufacturers, and the manufacturer is a fact about the brand, not about the shop. A manufacturer-seller is the special case with one brand of its own.

## Requirements

- **R1** — The public face is everything a storefront or an advertisement may show: mark, hero, tagline, story, location as the seller chooses to state it, delivery and returns terms, social handles. The private face is everything else: contact details, tax identifiers, commercial terms, brands, manufacturers, origin defaults, tax codes. A fact lives in exactly one face.
- **R2** — No public surface, page or payload can carry a private-face fact. This is a property of the structure, not a discipline at each call site ([seller-identity R5](../org-storefront/seller-identity/spec.md) stated the rule; this makes it structural).
- **R3** — An organisation holds any number of brands. Each brand names its manufacturer, its packer or importer, and its default country of origin. A seller with its own brand has one; a reseller has many; an unbranded range uses a brand named for that purpose.
- **R4** — Organisation-wide defaults exist for what does not belong to a brand: default origin, tax code per category it sells in, tax rate. Defaults pre-fill and never validate.
- **R5** — Nothing on either face is required to open a shop beyond what the shop needs to operate today: a name, a contact, and the categories it sells in. The word "required" appears only on a channel's readiness indicator, never on a profile form.
- **R6** — A fact first needed while listing a product — a manufacturer for Amazon, say — is asked for at that moment, and the seller is told, before saving, where the answer will live and what it will apply to: "Saved to the brand Xyz, and used for its 14 products." The seller can choose to apply it to this product only. Nothing is written to a brand or a default without that choice being visible, so it is asked once for the whole range by consent, never by surprise.
- **R7** — Onboarding is progressive: open the shop, describe it publicly, describe what it sells. Each step is saveable on its own and returns to later. The storefront is presentable after the first step ([storefront-pages R7a](../org-storefront/storefront-pages/spec.md)).
- **R8** — The about page and the storefront read the public face and nothing else, and look exactly as they do today the day this ships.
- **R9** — A brand or a default that products depend on is retired, never deleted, and a retired brand's products keep their values ([ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md)).
- **R10** — Everything here is editable from a phone, by a member of that organisation only.
- **R11** — Which brand is the default is never changed silently: making one the default says which brand stopped being it, and retiring the default warns first and says afterwards that none is set. A country of origin is chosen from a list, never typed.

## Product acceptance

- **A1** — A new organisation opens its shop with three facts and has a live storefront; nothing else is asked.
- **A2** — A reseller adds four brands with four different manufacturers in under two minutes on a phone, without being asked for anything they cannot answer from a pack label.
- **A3** — Every field in every public payload and page is one the seller would happily print on a shop sign. A GST number, a PAN, a commission rate or a manufacturer's address appears in none.
- **A4** — A seller who leaves manufacturer blank is never blocked from saving a profile, a brand or a product; they see why a given channel is not ready.
- **A4a** — When a seller fills in a fact at the point of need, the confirmation names the brand or default it will be saved to and how many products that covers, and offers "this product only". Nothing lands on the profile from a product screen without that line having been shown.
- **A5** — Retiring a brand leaves every product that used it unchanged.
- **A6** — After the data move alone, the about page renders identically, verified against a stored snapshot. It is then rebuilt as the shop's brand page in [brand-page](brand-page/), a subfeature of this spec, so the migration and the redesign never ship in one step.

## Out of scope (this feature)

- Linking products and families to brands, and the order in which a product's values are resolved — [listing-schema](../listing-schema/).
- The product-form screen that asks for a missing fact while listing. This feature builds where the answer is stored, the service that writes it, and the consent line of R6; the screen that pops the question is [product-form](../product-form/), three specs later. No product screen changes in this feature's PRs.
- Anything geographic about the public location: a map pin, geocoding, "ships from 12 km away", "sellers near you". Location here is one line of text the seller types, shown as typed. Precision is the seller's choice.
- A seller's own contact channel on the storefront, still [contact-us](../contact-us/) platform-scoped.


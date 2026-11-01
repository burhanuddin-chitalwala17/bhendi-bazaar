# Spec — own-store/org-profile

- **Summary:** A shop edits its own facts on one page that asks only what is needed, in plain words, each field saying who sees it and where
- **Status:** Implemented — 2026-11-01 (units 1–5)
- **Domain:** catalog (Org, OrgProfile)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-02
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [own-store](../spec.md) (Q14, Q15), [seller-onboarding](../seller-onboarding/) (asks these fields), [seller-profile](../../seller-profile/) (R1, R2, R5, R12), [brand-page](../../seller-profile/brand-page/), [org-storefront](../../org-storefront/), [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md (written after UX sign-off).

## What this feature is
Vertical 6 of own-store. One "Shop details" page holds the shop's facts in two labelled parts —
"Buyers see this" and "Only Bhendi Bazaar sees this" — with the few essentials first and every
optional field saying what it adds. How the shop page *looks* (theme, colours, cover picture,
banners, which sections show) is [storefront-themes](../spec.md), vertical 7, and not here.

## Why
The owner: "org profile needs proper guidance on what is essential — it asks unnecessary or
unclear questions; make them clear or remove them, keep only essentials." Today the shop's facts
are split across a create form the shop never sees again and a storefront editor that mixes
facts with looks, and a shop cannot change its own phone, email or name anywhere in the portal.

## Hazards this feature must close
- **One field, two names.** Create's "Description" writes the text the editor calls
  "Introduction"; a seller fills it twice or not at all.
- **Two names nobody can tell apart.** "Organisation Name" and "Business Name" sit together with
  no hint that one is shown to buyers and the other is the legal name for tax papers.
- **Asked too early.** GST and PAN are asked at creation, before anything needs them (own-store Q14).
- **No way to fix contact details.** Name, email and phone are set at creation and only the
  platform admin can change them; a shop with a new number stays unreachable.
- **Raw and vague fields.** "Accent" lists token names (`primary`, `info`); three "Block" pairs
  with "Woven near by" placeholders; "John Doe", "org@example.com", "ABC Traders Pvt Ltd".
- **Private next to public.** Nothing on screen says which fields a buyer reads, so a seller
  cannot tell whether typing their mobile number publishes it. The structure already keeps
  private facts off public pages (seller-profile R2); the page must say so.

## Requirements
- R1 — One Shop details page holds every fact about the shop, in two parts, each part headed by
  who sees it: "Buyers see this" (on your shop page) and "Only Bhendi Bazaar sees this".
- R2 — Each field has a plain label, a hint naming where it shows or why we need it, and an
  example placeholder from a real kind of shop; no sample names from elsewhere.
- R3 — Essentials come first and are few: shop name, mobile and email (asked at creation, Q2);
  logo and a one-line description (setup step 4). Everything else sits under "Add more to your
  shop page", each with the line it adds — never "required", never a score (seller-profile R12).
- R4 — Text a buyer reads has one home and one name: "About your shop" (Q4). A field never
  appears in two places with two names.
- R5 — The shop can change its name, mobile and email, and its shop link (existing handle
  change). A name change says where it shows; a link change warns that old links stop working.
- R6 — GST, PAN, legal name and bank details are not on this page until the first payout needs
  them (own-store Q14); the page says "We'll ask for tax and bank details before your first payout."
- R7 — Fields that are looks, not facts — accent, cover picture, hidden sections, the three
  "How you work" blocks — leave this page for storefront-themes (Q6); nothing a shop has typed
  is lost on the way.
- R8 — The internal org code never shows to the shop.
- R9 — ~~Every save is per section~~ (superseded by [Q30](decisions.md): one save bar for the page,
  each changed section still written alone). A save says what changed and where it shows ("Saved.
  Buyers see your new name now."), and keeps the seller on the page. No button is ever disabled (ADR-0053).
- R10 — "See as a buyer" from the page opens the shop page as a buyer sees it, so the seller
  checks the result without hunting for it.

## Product acceptance
Judged on a ~360px phone first.
- A1 — A new shop is asked three things at creation (name, mobile, email prefilled) and nothing else.
- A2 — On Shop details, every field states who sees it; a seller asked "will buyers see my
  mobile?" answers correctly from the screen alone.
- A3 — A shop changes its mobile number and its name itself, and the next order email and the
  shop page use the new values.
- A4 — "Description", "Introduction", "Business Name", "Accent", "Contact Person", "Block 1
  heading" and the org code appear nowhere in the seller portal, except the offer form's coupon
  prefix (Q28); the product form carries the code only as its upload folder (Q29).
- A5 — A shop that typed an introduction and a longer story before this ships sees both, in
  "About your shop", unchanged in meaning (Q4).
- A6 — Leaving every optional field blank never blocks a save or a sale.

## Scope
- **Outcome:** a shop keeps its own facts right from one clear page that asks only what matters.
- **In:** Shop details page with two parts (R1–R3, A2); one-name text (R4, A5); self-editing of
  name, contact and link (R5, A3); tax deferred (R6, A1); looks moved out (R7, A4); code hidden
  (R8); per-section save and buyer view (R9, R10, A6).
- **Delivery, five units:** 1 create form cut to three fields · 2 Shop details page, buyer part
  · 3 private part with name, mobile, email self-edit · 4 move looks to storefront-themes' home,
  data kept · 5 copy sweep and A4 check across the portal.
- **Later:** tax, legal name and bank at first payout (Q9) · a verified badge for checked shops
  (Q10) · a shop phone shown to buyers (Q8, if decided yes) · regional-language labels
  (own-store Later).

## Open questions
None — all decided; see [decisions.md](decisions.md).

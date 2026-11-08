# Spike — searchability: ranking on each channel, and being found by search and AI search

- **Status:** Findings ready for the owner (research only; no code, no decision)
- **Verified:** 2026-11-08
- **Asked by:** the owner, 2026-11-08: "I don't just want to be listed on the channel, I want to be listed
  optimally so that my product appears on the top … along with SEO I also want my items and the website to
  be AI search optimised"

> A `/bb-brainstorm` spike. Findings for the owner to decide from; each recommended outcome becomes its own
> `/bb-sdlc spec-start`, and this file is deleted once those specs exist (a spike is not a standing record).

## The question, made precise
"Appear on top" is three different problems, with different owners of the ranking:
1. **Marketplace search** (Amazon, Flipkart, Meesho): the channel ranks our listing against other sellers'.
2. **Shopping surfaces fed by our feed** (Google free listings and AI Mode, Meta): ranked from the data we send.
3. **Open web and AI answers** (Google Search, ChatGPT search, Claude, Perplexity): ranked from our own pages.

On every surface the signals fall in three bands. Only the first is fully ours to set:
- **Relevance** — does the listing contain the words and attributes a shopper's query and filters use.
  Entirely data we send: title, attributes, bullets, search terms, structured data.
- **Performance** — sales, conversion, ratings, price, stock, delivery speed. Partly ours (stock sync,
  price, dispatch time, review requests), mostly earned over time.
- **Eligibility** — not suppressed: valid data, policy-clean images and titles, a healthy seller account.

No channel publishes its weights; vendor guides disagree on details. What follows is what the channels
themselves document, plus what our code does today.

## What exists here today
- **Amazon create** (`amazonCreateBody`, `server/channels/providers/amazon/amazon.publish.ts`): title =
  product name, up to five features as bullets, description. **Search Terms (`generic_keyword`) is never
  sent.** HANDBAG's schema allows it (500 characters a value) and describes it as "terms that may be
  relevant to customer searches. No repetition, no competitor brand names or ASINs". Title limit 200,
  bullet 700 a value, description 20,000 bytes (all from `tests/fixtures/amazon/HANDBAG.schema.json`).
- **Readiness** now names what a channel *requires* (channel-catalogue). Nothing yet says how *well* a
  listing is described: optional attributes that filters read are invisible to it.
- **Google and Meta feed** (`server/listing/shopfront-feed.ts`): id, title, description, link, images,
  availability, price, sale price, brand, condition, `identifier_exists=no`, category. **No colour,
  size, gender, age group, material, pattern, `item_group_id` or product type**, which Google lists as
  required (apparel, outside India) or recommended, and says it uses "to match your products with what
  customers might be searching for". Field-maps is planned to send them (channel-catalogue Q8).
- **Our product pages' structured data** (`productJsonLd`, `src/lib/structured-data.ts`): name, url,
  images, description, one `Offer` (price, currency, availability, condition, seller). Missing every
  property Google lists as recommended for merchant listings: `brand`, `sku`, `color`, `material`,
  `size`, `audience`, `aggregateRating`/`review`, `inProductGroupWithID`, and on the offer
  `shippingDetails` and `hasMerchantReturnPolicy`. Organization, WebSite (with SearchAction) and
  BreadcrumbList are emitted.
- **Crawling**: `robots.ts` allows every agent except private paths — **unless `BLOCK_CRAWLERS=1`**,
  the pre-launch switch (`src/lib/crawl-block.ts`) that disallows everything and stamps `noindex`.
- **SEO spec** (`docs/specs/seo/`) is Draft since 2026-09-19 (R1–R11: titles, honest price markup,
  breadcrumbs, status codes, sitemap dates, alt text, server rendering). Much of it is built; its status
  was never reconciled.

## What the channels say (checked 2026-11-08)
- **Google free listings / Merchant Center** ([best practices](https://support.google.com/merchants/answer/9668403)):
  "We rely on the data that you provide to us to match your products with what customers might be
  searching for." Apparel needs colour, size, age group, gender; pattern and material recommended;
  `item_group_id` to group variants; return policy in Merchant Center shows "next to your products".
  Placement is not guaranteed and data must match the site, prices included.
- **Google merchant listing markup** ([docs](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)):
  makes a page eligible for the shopping knowledge panel, Images, popular products and product snippets
  with price, availability, shipping and returns. Organisation-level shipping and return policies are
  the recommended default; a Merchant Center feed outranks page markup where both exist.
- **Google AI Overviews and AI Mode** ([docs](https://developers.google.com/search/docs/appearance/ai-features)):
  "no additional technical requirements"; "You don't need to create new machine readable files, AI text
  files, or markup"; Google-Extended governs training and grounding elsewhere, **not** Search.
  So for Google, AI visibility is ordinary SEO plus a good Merchant Center feed. `llms.txt` buys nothing here.
- **OpenAI** ([bots](https://developers.openai.com/api/docs/bots)): `OAI-SearchBot` surfaces sites in
  ChatGPT search ("Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search
  answers"); `GPTBot` is training only; `ChatGPT-User` is user-initiated and "robots.txt rules may not
  apply". ChatGPT shopping takes merchant product feeds by application (chatgpt.com/merchants);
  Instant Checkout is US-first, and **we found nothing on India availability**.
- **Anthropic** (secondary sources; Anthropic's page not fetched): `ClaudeBot` training,
  `Claude-SearchBot` search quality, `Claude-User` user-initiated; each needs its own robots rule.
- **Perplexity** (secondary sources): `PerplexityBot` indexes and obeys robots.txt; a free Merchant
  Program lists products in Perplexity Shopping; checkout is US-first.
- **Amazon, Flipkart, Meesho**: their ranking guidance sits behind seller logins; public material is
  vendor guides. Consistent across them: the title is the strongest relevance signal; attributes feed
  filters; stock-outs and late dispatch cost rank; ratings and price matter. Treat specifics as unverified.

## Options (each would be its own spec)
**O1 — Listing quality score per channel (advise, never gate).** Readiness grows a second axis: "how well
is this described for {channel}". Inputs already stored after field-maps: optional attributes that the
channel's filters read (from the catalogue), title length and contents against the channel's limit,
bullets present, Amazon search terms present, image count and size, variants grouped. Output: a score and
the three fixes worth most. Cost: moderate; reuses the catalogue and completeness job (parent TRD D9).
Assumes we can say which optional fields matter — Google and Meta document it; Amazon's `allOf` rules and
the HANDBAG schema's descriptions do partly; Flipkart and Meesho only by template.

**O2 — Titles, bullets and search terms built from attributes.** One template per channel and type
(e.g. "{brand} {audience} {type} — {outer material}, {colour}, {key feature}") filled from canonical
attributes, editable per product as an override (parent Q7). Amazon `generic_keyword` from per-type
synonyms ("tote, shoulder bag, jhola") maintained as reference data. Cost: small to moderate; no new
package. Forecloses nothing: a later AI writer (O2b) fills the same override.
- **O2b — AI-written copy** (Claude) for titles, bullets, descriptions, from the product's attributes and
  photos, shown as a suggestion the shop accepts. Adds a package and a per-call cost; needs its own TRD.

**O3 — Our own site: richer machine-readable products.** Extend `productJsonLd` with the recommended
properties we already hold (brand, sku, colour, material, size, audience, ratings over the R4 floor,
variant group), and org-level shipping and return policies (`store-policies` already holds the words).
Cost: small; one module and its tests. Same data as the feed, so it cannot drift if both read one builder.

**O4 — Crawler policy, stated per agent.** Name the search agents explicitly as allowed
(`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Googlebot`, `Bingbot`) and decide the
training agents (`GPTBot`, `ClaudeBot`, `Google-Extended`) as an owner choice. Cost: trivial. `llms.txt`:
optional, cheap, ignored by Google; worth it only as a plain description page for agents that read it.

**O5 — AI shopping programmes.** Apply to ChatGPT merchants and Perplexity's Merchant Program with the
feed we already build. Cost: an application and a feed variant; value in India unknown today.

**O6 — Content for answers.** Category and product pages carry the facts AI answers quote: sizes and
measurements in text, material and care, a short FAQ per category (returns, delivery time, sizing). Cost:
copy work more than code; fits the copy-module rule (ADR-0067).

## Failure modes
- A score that rewards stuffing (repeated keywords) is penalised by every channel: O1 must cap and
  penalise repetition, and O2 must never repeat a word across title and search terms.
- Markup that disagrees with the page or feed (price, availability) is a Google policy violation:
  O3 must read the same price function as the page (ADR-0018), as it already does.
- A template title that reads badly converts worse, and conversion is a ranking signal: O2 needs the
  shop's override and a length check per channel.
- Allowing training crawlers is a business choice, not an SEO one; blocking the search agents removes us
  from those answers.

## Recommendation (Claude's, for the owner to decide)
1. ~~Confirm `BLOCK_CRAWLERS` is unset and Merchant Center live~~: both confirmed by the owner.
2. **Field-maps first** (already next): sending the attributes we hold is the largest relevance gain on
   Google, Meta and Amazon at once, and O1–O3 read what it builds.
3. **Then O3** as one small spec ("the site describes every product fully"): days, not weeks. O4 is
   only the firewall check above.
4. **Then O1 + O2** as one spec ("each listing is described to rank"), O2b parked as Later.
5. **O5 and O6 parked**: O5 until India availability is known; O6 as copy work alongside dynamic-form.

## Owner's answers (2026-11-08)
- **`BLOCK_CRAWLERS` is unset in production**: crawlers are allowed today.
- **Merchant Center free listings are live**: the feed is already ranked; what it omits is the gap.
- **Allow all crawlers, training ones included** (`GPTBot`, `ClaudeBot`, `Google-Extended`). `robots.ts`
  already allows `*`, so O4 needs no change to robots; what remains is checking nothing upstream blocks
  them (Vercel's Firewall has bot and AI-bot rules that act before `robots.txt` is read).
- **Niqab Boutique's brand is not in Amazon Brand Registry**: A+ content and brand analytics are out of
  reach; listings rely on title, bullets, attributes, search terms and images alone, which raises the value
  of O1 and O2 on Amazon. Registration (with a trademark application) is the owner's call, outside this programme.

## Open questions
- Is any Vercel Firewall rule (bot protection, AI bots) blocking the agents the owner wants allowed?
  Checked in the Vercel dashboard, Firewall; closes O4.
- Which Amazon search-term length is indexed: the schema allows 500 characters a value; seller guides
  cite a 250-byte index limit. Only Seller Central's help (login) settles it.
- Flipkart's and Meesho's own ranking documentation (seller-login only): what their quality scores read.

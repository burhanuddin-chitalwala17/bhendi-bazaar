# Spec — social-selling (overview)

- **Summary:** A shop runs its Instagram and WhatsApp from Bhendi Bazaar: connect each once, its catalogue on WhatsApp, its posts and stories scheduled and published, one inbox for DMs and comments, and messages to customers who opted in
- **Status:** Draft
- **Domain:** channels, with new tool domains (inbox, social, audience, campaigns, automations)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** [decisions.md](decisions.md), [INTEGRATIONS.md](../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [shopfront-feeds](../shopfront-feeds/), [marketplace-integration](../marketplace-integration/), [ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0061](../../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)

> The parent of the subfeatures below. Each gets its own spec, decisions, UX and TRD when it is
> started; this file holds only the model they share, their order and where work stands.
> Every decision, with who made it, is in decisions.md.

## Pick up here
Development continues in another Claude account. Work on branch `meta-whatsapp-connector`; a track
may run on its own branch off it and merge back; the whole feature merges to `main` once. The
research is in INTEGRATIONS.md under "Acting for a shop on Meta" and "What an inbox receives and
may do"; do not redo it. Specs here are committed as written, by the owner's instruction, so the
other account's session can read them.
**Re-cut and audited 2026-11-21.** The work runs in the eight steps below (Q107); decisions.md was
merged to one row per lasting question, its absorbed ids listed at its end. Before each step's
build, bring its subfeature specs in line: Q1 (message access) into connect-instagram and
inbox-instagram; Q12 (contact sync, offboarding) into connect-whatsapp; Q96 into audience,
whatsapp-contacts and inbox-whatsapp; Q7 (reconciling missed webhooks) into both platform inboxes;
Q97 into inbox-whatsapp. chat-autoreplies (Q89), whatsapp-catalogue-import (Q47) and bulk-publish
(Q102) need their own specs; going-live.md takes Q2's timing.
**Next step:** re-cut and write the step-2 specs, then their UX and prototype (Q108), module by
module. Step 1 (post generation) runs in its own session.
**Owner's outside step, started separately:** Meta Business Verification and the Meta app (Q14).

## What this is
A shop sells through its own Instagram and WhatsApp without leaving Bhendi Bazaar (Q5). It connects
its accounts once; its products appear in its WhatsApp catalogue, always matching the store; it
publishes posts and stories; it answers every message and comment from one inbox, with automatic
replies so no enquiry is lost; and it messages customers who asked to hear from it. Shop owners and
members run it; buyers meet it on Instagram and WhatsApp.

Five modules make it up: **Connect**, **Catalogue**, **Post**, **Converse** (the inbox and automatic
replies) and **Reach out** (consent, and messages to opted-in customers). Siblings it uses, outside
it: post generation, notification-hub, bulk-publish and checkout links.

## Why
Indian sellers sell through Instagram and WhatsApp, and today pay three or four separate tools for
it (a WhatsApp tool, an AI post tool, a scheduler), none of which knows their stock, live price,
Amazon and Flipkart listings or auctions. Bhendi Bazaar already does; this makes it the one place.
Making a post (graphics, captions, AI) is a separate vertical, not part of this feature (Q26).

## The model every subfeature follows
- **Each platform is its own connection, under one Meta app and one review (Q1, Q2).** Instagram
  by Instagram's own login: a professional account, no Facebook Page, no business account (Q1).
  WhatsApp by Meta's signup pop-up, which creates a business account inside the flow when the shop
  has none. A Facebook Page is a later, optional connection.
- **Only `channels` knows Meta (Q7).** Inbox, posting, audience, campaigns and automations are
  tools that know nothing of any platform; a platform is a plug `channels` provides. One signed
  webhook in `channels` turns Meta's events into neutral jobs on the queue that the tools consume.
  Adding WhatsApp to the inbox, or Threads to posting, is a new plug and no change to the tool.
- **Posting is to the shop's own accounts (Q3).** Never to a platform account of ours.
- **Posting publishes; it never makes the post (Q26).** It takes finished media and a caption,
  from the shop's upload, its media library or any future generator, and schedules, publishes and
  reports on them. It knows nothing of how they were made; generation knows nothing of platforms.
- **A contact is not consent (Q9).** A marketing message goes only to someone who opted in, with
  when and where recorded; a contact list arrives as "Not yet". An uploaded list is messageable
  when the shop attests to its permission, and the attestation is recorded.
- **The shop pays Meta for its own messages (Q8)** and sees the cost before a send. Money in paise.
- **Promise only what Meta allows in India (Q18).** No product tags, no Status or Channels by API,
  no group broadcasts. A WhatsApp Status goes as a one-tap handoff to the phone.
- **Instagram before paid WhatsApp messaging (Q107).** Comment-to-DM is free; messages cost.
- **No enquiry waits for the owner (Q89).** Auto-replies answer every comment, DM and chat at
  once from live data, and hand over to a person; AI wording comes last, in step 8 (Q107).

## Modules and subfeatures
The tree, cut from the base feature (Q5, Q108). A module is a capability; a subfeature is one
shippable outcome inside it. "Folder" says whether its spec exists yet: **re-cut** means an existing
folder is merged, split or renamed into it; **new** means it is still to be written.

| Module | Subfeature | Outcome | Folder | Domain |
|---|---|---|---|---|
| Connect | meta-foundation | Meta's app plumbing both connections share: signed webhooks, events stored once, data-deletion and app-removed callbacks, the Coming soon switch | rewritten 2026-11-22 | channels |
| Connect | connect-instagram | A shop connects its Instagram professional account and sees it healthy, message access included (Q1) | rewritten 2026-11-22 | channels |
| Connect | connect-whatsapp | A shop connects its WhatsApp number, keeping its Business app, and sees it healthy (Q12) | rewritten 2026-11-22 | channels |
| Catalogue | whatsapp-catalogue-import | A catalogue the shop already has is settled: matched, added or left off (Q47) | rewritten 2026-11-22 | channels |
| Catalogue | whatsapp-catalogue | The shop's live products in its WhatsApp catalogue, an exact copy kept in sync, cart on (Q47) | rewritten 2026-11-22 | channels |
| Post | post-composer | Compose and schedule a post or story from the library to any destination; other modules add panels to it | re-cut from post-scheduling | social |
| Post | instagram-publishing | Feed, carousel, reel and story published to Instagram, with everything its API allows | exists | channels |
| Post | whatsapp-status-kit | A Status ready on time, one tap from the phone (Q18) | exists | social |
| Converse | inbox-core | The inbox shell: a tab per platform, reply box, reply windows, unread (Q63) | exists | inbox |
| Converse | inbox-instagram | DMs, story replies and comments answered from the inbox (Q36) | exists | channels |
| Converse | inbox-whatsapp | Chats answered from the inbox, templates after 24 hours, a sent cart as an order card (Q97) | exists | channels |
| Converse | comment-automations | A keyword comment gets the shop's DM; its rules are its own, shown as a panel in post-composer | exists | automations |
| Converse | enquiry-autoreplies | Every DM and chat answered at once: greeting, away message by business hours, FAQs, starter questions, buttons, handover (Q89) | new | automations |
| Converse | product-answers | A question about a product answered from live price, stock and sizes, with a Buy link; a missed-enquiry count (Q89) | new | automations |
| Converse | ai-autoreplies | AI wording over the same live data | parked (Q89) | automations |
| Reach out | consent-core | Consent per sender and channel, the one "may I message?" answer, YES, STOP and HINDI in chat, contacts synced from the phone (Q9) | re-cut from audience and whatsapp-contacts | audience |
| Reach out | whatsapp-sending | The one WhatsApp send every caller uses: consent and caps checked, spend cap, cost in paise, starter and own templates (Q8, Q37) | re-cut from whatsapp-campaigns and whatsapp-templates | campaigns |
| Reach out | audience | The Audience page: lists, uploads with attestation, the checkout box, the store page's button (Q75) | re-cut | audience |
| Reach out | whatsapp-campaigns | A campaign composed, its cost reviewed, scheduled and reported (Q40) | re-cut | campaigns |

**Siblings, outside the base:** post-generation (the released ai-images feature, given a social
purpose, Q26), notification-hub (notifications-core re-cut from hub-core, then hub-marketing,
order-updates, demand-alerts, Q66), bulk-publish (Q102), checkout-links (Q108).

### Build order (Q107)
| Step | Built | ⏳ |
|---|---|---|
| 1 | post-generation, side by side with step 2 | |
| 2 | meta-foundation, connect-instagram, connect-whatsapp, whatsapp-catalogue-import, whatsapp-catalogue; notifications-core; bulk-publish | ⏳ |
| 3 | post-composer, instagram-publishing, whatsapp-status-kit | ⏳ |
| 4 | inbox-core | |
| 5 | inbox-instagram, consent-core, whatsapp-sending, checkout-links, inbox-whatsapp | ⏳ |
| 6 | comment-automations, enquiry-autoreplies, product-answers; then the single Meta review (Q2) | ⏳ |
| 7 | audience, whatsapp-campaigns; hub-marketing, order-updates, demand-alerts | |
| 8 | ai-autoreplies | |

A module is not a step: consent-core and whatsapp-sending belong to Reach out but are built in
step 5, because the WhatsApp inbox needs them. Going live is [going-live.md](going-live.md).

Later: ads, Facebook Page, Threads, checkout in WhatsApp, forms in chat and insights (Q21); platform
sending (Q27); the audit screen (Q34); assigning conversations (Q63); sales per post or message
(Q108). Not imported: chat history (Q12).

## Product acceptance
- A1 — On a phone, a shop with only an Instagram professional account connects it and publishes
  a story from a photo it chose, without leaving Bhendi Bazaar.
- A2 — A comment with a chosen keyword on that shop's post receives the shop's DM (the product
  link unless the shop changed it).
- A3 — A shop with no Meta business account connects its WhatsApp number from the pop-up and,
  minutes later, its products are in its WhatsApp catalogue at the price its product page shows.
- A4 — A message to a list reaches only its opted-in members, after the shop saw what it costs.

## Open questions
Q47 (left-off items removed from WhatsApp) and Q102 (when Amazon and Flipkart get bulk-publish),
both waiting on the owner.

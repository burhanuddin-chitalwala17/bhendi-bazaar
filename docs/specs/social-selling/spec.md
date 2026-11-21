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
Development continues in another Claude account (Q17). Work on branch `meta-whatsapp-connector`;
a track may run on its own branch off it and merge back; the whole feature merges to `main` once
(Q16). The research is in INTEGRATIONS.md under "Acting for a shop on Meta" and "What an inbox
receives and may do"; do not redo it.
**Re-cut 2026-11-21 (Q78, Q86–Q100).** The work runs in the eight steps below. Before each step's
build, bring its subfeature specs in line with these decisions: Q94 into connect-instagram and
inbox-instagram; Q99 into connect-whatsapp; Q96 into audience, whatsapp-contacts and inbox-whatsapp;
Q98 into both platform inboxes; Q95 and Q97, once the owner answers, into the two inboxes;
chat-autoreplies (Q89) needs its own spec; going-live.md takes Q100.
**Next step:** step 1 (post generation, its own session) and step 2 (connectors) side by side (Q87).
**Owner's outside step, started separately:** Meta Business Verification and the Meta app (Q14).

## What this is
A shop's Instagram and WhatsApp, worked from Bhendi Bazaar for selling: its products in its
WhatsApp catalogue, its posts and stories scheduled and published, the conversations they start answered
in one place, and messages to customers who asked for them. The shop never leaves the platform.

## Why
Indian sellers sell through Instagram and WhatsApp, and today pay three or four separate tools for
it (a WhatsApp tool, an AI post tool, a scheduler), none of which knows their stock, live price,
Amazon and Flipkart listings or auctions. Bhendi Bazaar already does; this makes it the one place.
Making a post (graphics, captions, AI) is a separate vertical, not part of this feature (Q26).

## The model every subfeature follows
- **Each platform is its own connection, under one Meta app and one review (Q1, Q2).** Instagram
  by Instagram's own login: a professional account, no Facebook Page, no business account (Q11).
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
- **Promise only what Meta allows in India.** No product tags (Q18), no Status or Channels by API
  (Q19), no group broadcasts (Q20). A WhatsApp Status goes as a one-tap handoff to the phone.
- **Instagram before paid WhatsApp messaging (Q6).** Comment-to-DM is free; messages cost.
- **No enquiry waits for the owner (Q89).** Auto-replies answer every comment, DM and chat at
  once from live data, and hand over to a person; AI wording comes last, in step 8 (Q91).

## Subfeatures, in order
Eight steps, each a module finished before the next, except steps 1 and 2, which run side by side
(Q78, Q87). Each subfeature has its own spec, decisions, UX and TRD in a subfolder; chat-autoreplies
is yet to be written. ⏳ marks what the single review gates; it is submitted once steps 2–6 work on
our own accounts (Q2, Q100).

| Step | Module | Subfeature | Outcome | Domain |
|---|---|---|---|---|
| 1 | Post generation | outside this folder (Q86) | Post images and captions made from a product or the brand, into the media library | content |
| 2 | Connectors | connect-instagram | A shop connects its Instagram and sees it healthy, message access included (Q94) ⏳ | channels |
| 2 | Connectors | connect-whatsapp | A shop connects its WhatsApp number, keeping its Business app (Q12) ⏳ | channels |
| 2 | Connectors | whatsapp-catalogue | The shop's live products in its WhatsApp catalogue, kept in sync (Q88) ⏳ | channels |
| 3 | Posting | post-scheduling | Schedule a post or story from finished media and a caption, through a fake publisher | social |
| 3 | Posting | instagram-publishing | Posts, carousels, reels and stories published to Instagram, with hashtags, mentions and collaborators ⏳ | channels |
| 3 | Posting | whatsapp-status-kit | A Status image and caption handed to the phone in one tap; WhatsApp has no Status API (Q19) | social |
| 4 | Inbox | inbox-core | The inbox shell: a tab per platform, nothing enabled yet (Q92) | inbox |
| 5 | Platform inboxes | inbox-instagram | Instagram DMs and comments answered from the inbox ⏳ | channels |
| 5 | Platform inboxes | inbox-whatsapp | WhatsApp chats answered from the inbox ⏳ | channels |
| 5 | Platform inboxes | whatsapp-contacts | The Business app's contacts arrive as Not yet; opt-in and STOP in chat | audience |
| 5 | Platform inboxes | whatsapp-templates | Starter templates in English and Hindi, and the shop's own, for replies past 24 hours ⏳ | campaigns |
| 6 | Auto-replies | comment-automations | A keyword comment gets the shop's DM, the product link suggested ⏳ | automations |
| 6 | Auto-replies | chat-autoreplies | Every DM and chat answered at once: greeting, away hours, FAQs, live price and stock, handover (Q89) ⏳ | automations |
| 7 | Outbound | audience | Contacts, consent and lists; from orders, the store page and attested uploads | audience |
| 7 | Outbound | whatsapp-campaigns | A campaign, products included, sent to an opted-in list, cost and caps shown | campaigns |
| 7 | Outbound | [notification-hub](../notification-hub/spec.md) | Order updates and alerts, by WhatsApp and email (Q66) | notifications |
| 8 | AI auto-replies | not yet specified (Q91) | Answers worded by AI from the same live data, picked up once steps 1–7 are done | automations |
| — | **Going live** | [going-live.md](going-live.md) | One review once steps 2–6 work on our own accounts (Q100) | — |

Later, each with its Q: ads (Q21), Facebook Page (Q22), Threads (Q23), checkout in WhatsApp (Q24),
forms in chat (Q25), chat history (Q10), platform sending (Q28), audit screen (Q44), insights
(Q48). Outside this feature: "Notify me" (Q60).

## Product acceptance
- A1 — On a phone, a shop with only an Instagram professional account connects it and publishes
  a story from a photo it chose, without leaving Bhendi Bazaar.
- A2 — A comment with a chosen keyword on that shop's post receives the shop's DM (the product
  link unless the shop changed it).
- A3 — A shop with no Meta business account connects its WhatsApp number from the pop-up and,
  minutes later, its products are in its WhatsApp catalogue at the price its product page shows.
- A4 — A message to a list reaches only its opted-in members, after the shop saw what it costs.

## Open questions
Q95 (Instagram story replies in the inbox) and Q97 (a WhatsApp catalogue cart in the inbox), both
waiting on the owner.

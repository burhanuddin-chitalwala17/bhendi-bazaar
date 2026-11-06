# Spec — social-selling (overview)

- **Summary:** A shop runs its Instagram and WhatsApp from Bhendi Bazaar: connect each once, its catalogue on WhatsApp, its posts and stories scheduled and published, one inbox for DMs and comments, and messages to customers who opted in
- **Status:** Draft
- **Domain:** channels, with new tool domains (inbox, social, audience, campaigns, automations)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [INTEGRATIONS.md](../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [shopfront-feeds](../shopfront-feeds/), [marketplace-integration](../marketplace-integration/), [ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0061](../../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)

> The parent of the subfeatures below. Each gets its own spec, decisions, UX and TRD when it is
> started; this file holds only the model they share, their order and where work stands.
> Every decision, with who made it, is in decisions.md.

## Pick up here
Development continues in another Claude account (Q17). Work on branch `meta-whatsapp-connector`;
a track may run on its own branch off it and merge back; the whole feature merges to `main` once
(Q16). The research is in INTEGRATIONS.md under "Acting for a shop on Meta"; do not redo it.
**Next step:** the owner reviews every subfeature's spec, UX prototype and TRD, and notification-hub's,
then gives the go-ahead to build; `/bb-build` runs them in the order above.
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

## Subfeatures, in order
Each has its own spec, decisions, UX and TRD in a subfolder. "Needs" is the only ordering; anything
with its needs met may be built alongside the others. ⏳ marks what the single review gates (Q2).
Notifications and alerts are not here: they are the sibling feature
[notification-hub](../notification-hub/spec.md), whose first user this is (Q66).

| # | Subfeature | Outcome | Needs | Domain |
|---|---|---|---|---|
| 1 | connect-instagram | A shop connects its Instagram and sees it healthy ⏳ | — | channels |
| 2 | connect-whatsapp | A shop connects its WhatsApp number, keeping its Business app (Q12) ⏳ | — | channels |
| 3 | inbox-core | One inbox: conversations, replies, unread, from a fake source | — | inbox |
| 4 | post-scheduling | Schedule a post or story from finished media and a caption, through a fake publisher | — | social |
| 5 | audience | Contacts, consent and lists; from orders, the store page and attested uploads | — | audience |
| 6 | instagram-publishing | Posts, carousels, reels and stories published to Instagram ⏳ | 1, 4 | channels |
| 7 | inbox-instagram | Instagram DMs and comments in the inbox ⏳ | 1, 3 | channels |
| 8 | comment-automations | A keyword comment gets the shop's DM, the product link suggested ⏳ | 7 | automations |
| 9 | whatsapp-catalogue | The shop's live products in its WhatsApp catalogue, kept in sync ⏳ | 2 | channels |
| 10 | inbox-whatsapp | WhatsApp chats in the inbox ⏳ | 2, 3 | channels |
| 11 | whatsapp-contacts | Contacts synced from the Business app as "Not yet"; opt-in and STOP in chat | 2, 5 | audience |
| 12 | whatsapp-templates | Starter templates in English and Hindi, and the shop's own, with Meta's status ⏳ | 2 | campaigns |
| 13 | whatsapp-campaigns | A campaign, products included, sent to an opted-in list, cost and caps shown ⏳ | 5, 12 | campaigns |
| 14 | whatsapp-status-kit | A Status image and caption handed to the phone in one tap | 4 | social |
| — | **Going live** | One review once 1, 2, 6–10, 12 and 13 work on our own accounts ([going-live.md](going-live.md)) | ⏳ | — |

Later, each with its Q: ads (Q21), Facebook Page (Q22), Threads (Q23), checkout in WhatsApp (Q24),
forms in chat (Q25), chat history (Q10), platform sending (Q28), AI replies (Q31), audit screen
(Q44), insights (Q48). Outside this feature altogether: post generation (Q26) and "Notify me" (Q60).

## Product acceptance
- A1 — On a phone, a shop with only an Instagram professional account connects it and publishes
  a story from a photo it chose, without leaving Bhendi Bazaar.
- A2 — A comment with a chosen keyword on that shop's post receives the shop's DM (the product
  link unless the shop changed it).
- A3 — A shop with no Meta business account connects its WhatsApp number from the pop-up and,
  minutes later, its products are in its WhatsApp catalogue at the price its product page shows.
- A4 — A message to a list reaches only its opted-in members, after the shop saw what it costs.

## Open questions
None at the overview. Each subfeature opens its own.

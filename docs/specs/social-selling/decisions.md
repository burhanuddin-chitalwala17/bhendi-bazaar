# Decisions — social-selling

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. A subfeature's own decisions go in its own
> decisions.md and cite these ids. Decided in planning sessions, 2026-11-05 and 2026-11-06.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | One "Connect Meta" or a connection per platform? | A connection per platform, under one Meta app: Instagram by Instagram's own login; WhatsApp by Meta's signup pop-up; a Facebook Page later and optional | Owner | 2026-11-06 | Easier for shops: no Facebook Page or business account needed for Instagram, and the pop-up creates one for WhatsApp. What a linked business account adds is ads (Q21), already Later | decided |
| Q2 | One Meta review or one per stage? | One submission, made once every reviewed permission works on our own accounts | Owner | 2026-11-06 | Less paperwork. Cost accepted: no other shop can connect Instagram until WhatsApp messaging is built too | decided |
| Q3 | May posting go to a platform account of ours instead of the shop's? | No. Every post and message goes from the shop's own connected account | Owner | 2026-11-05 | The shop must never leave the platform, and it posts as itself | decided |
| Q4 | Direct with Meta or through a WhatsApp provider (Gupshup, Interakt)? | Direct with Meta, as a Tech Provider | Owner | 2026-11-05 | No provider markup; we own the integration | decided |
| Q5 | How much is one feature? | All three (catalogue, posting, messaging) under this overview, cut into the subfeatures in spec.md | Owner | 2026-11-05 | One feature in the owner's terms; ADR-0061 still caps each subfeature | decided |
| Q6 | In what order? | Instagram first, including its inbox and comment-to-DM; paid WhatsApp messaging after | Owner | 2026-11-06 | Comment-to-DM is free; WhatsApp charges per message | decided |
| Q7 | How are the modules kept apart? | Only `channels` knows Meta. Inbox, posting (social), audience, campaigns and automations are platform-free tools; each declares a port, `channels` supplies the plug. Meta's events enter at one signed webhook in `channels` and reach the tools as neutral jobs on the queue. The boundary test forbids the tools from importing `channels` providers | Owner | 2026-11-06 | "One inbox is a tool and we keep adding channels in it" | decided |
| Q8 | Who pays Meta for WhatsApp messages? | The shop, from its own WhatsApp account and payment method; Bhendi Bazaar shows the cost before a send and records it in paise | Owner | 2026-11-06 | Meta's default; no billing liability for the platform | decided |
| Q9 | When may a contact be sent marketing? | Only once opted in, with when and where recorded: a box at checkout, "Get offers on WhatsApp" on the shop page, YES in a chat, or an uploaded list the shop attests it has permission for (the attestation recorded: who, when, which file). Synced contacts arrive as "Not yet" | Owner | 2026-11-06 | Meta's policy; a reported number loses its templates. DPDP applies to holding the data | decided |
| Q10 | Import a WhatsApp number's chat history on connect? | No. The inbox starts on the day of connecting | Owner | 2026-11-06 | Less personal data held. Meta offers history only during the connect step, so a shop wanting it later reconnects | parked |
| Q11 | What must a shop have to connect Instagram? | An Instagram professional account (business or creator), switched to for free in the Instagram app; we show the steps | Owner | 2026-11-06 | Instagram's own login needs no Page. was: a professional account linked to a Facebook Page | decided |
| Q12 | May a shop keep using its WhatsApp Business app on the same number? | Yes: onboard by coexistence; messages appear in both | Claude · reversible | 2026-11-06 | Shops will not give up the app. Throughput is 20 per second, ample | decided |
| Q13 | Are the Business app's contacts brought in? | Yes, as "Not yet" (Q9), kept updated by Meta's contact webhook | Owner | 2026-11-06 | They become an audience only through opt-in | decided |
| Q14 | What is started outside the code now? | The owner starts Meta Business Verification and creates the Meta app, with privacy and data-deletion pages | Owner | 2026-11-05 | Verification takes days and gates the review | decided |
| Q15 | Does Meta stay a feed-only shopfront (ADR-0041)? | No: a connected shopfront. Written as a new ADR superseding ADR-0041's "no credentials" for Meta, in connect-instagram's TRD | Claude · reversible | 2026-11-06 | Posting and messaging need the shop's grant; the sale still completes here | decided |
| Q16 | How is the work branched? | On `meta-whatsapp-connector`; a track may use its own branch off it and merge back; one merge to `main` at the end | Owner | 2026-11-05 | The owner merges once when it is done | decided |
| Q17 | Where does context live between sessions? | In this folder and INTEGRATIONS.md, committed and pushed: development continues in another Claude account. Specs are committed when written, by the owner's instruction, overriding "uncommitted until read" | Owner | 2026-11-06 | A new session in another account sees only the repository | decided |
| Q18 | Instagram product tags? | Not offered: Meta allows them only to shops with checkout, which India lacks | Claude · reversible | 2026-11-05 | Re-check `shopping_product_tag_eligibility` if Meta's checkout reaches India | decided |
| Q19 | WhatsApp Status and Channels? | No API exists; a Status is a one-tap handoff of the image and caption to the phone (whatsapp-status-kit) | Claude · reversible | 2026-11-05 | The only route Meta permits | decided |
| Q20 | WhatsApp groups for broadcasting? | Not used: the API caps a group at 8 | Claude · reversible | 2026-11-06 | A list of opted-in contacts does the job | decided |
| Q21 | Ads: boosting, Click-to-WhatsApp, catalogue ads | Later, behind its own review and a linked Facebook business account | Owner | 2026-11-06 | Needs Facebook's login and ads permissions | parked |
| Q22 | Facebook Page posting | Later, as an optional connection and a plug in post-composer | Claude · reversible | 2026-11-06 | Not needed for Instagram under Q11 | parked |
| Q23 | Threads posting | Later, as a plug in post-composer | Claude · reversible | 2026-11-06 | Its own login and review | parked |
| Q24 | Checkout inside WhatsApp (UPI or Razorpay in chat) | Later, with an ADR showing Invariant 2 holds | Owner | 2026-11-05 | Touches payment state | parked |
| Q25 | Forms in chat (WhatsApp Flows) | Later | Claude · reversible | 2026-11-05 | Not needed for any acceptance here | parked |

## Parked (Later)
- Q10 — chat history on connect; would need a reconnect.
- Q21 — ads; a feature of its own after social-selling, with its own review.
- Q22, Q23 — Facebook Page and Threads posting; each a plug in post-composer.
- Q24 — checkout inside WhatsApp; its own feature and ADR.
- Q25 — WhatsApp Flows.

# Decisions — social-selling/whatsapp-status-kit

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q19, Q26, Q41, Q64, Q66, Q67.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | How does a Status reach WhatsApp? | At the scheduled time the destination turns "Ready for Status" and a "post due" event goes to notifications. On the phone, Share to Status hands the image (or video) and the caption to the phone's share sheet, where the shop picks WhatsApp or WhatsApp Business, then My Status | Owner (parent Q67) | 2026-11-06 | No Status API exists, and we have no WhatsApp number to message the shop from | decided |
| Q2 | How is the caption carried, given WhatsApp ignores shared text on images on some phones? | Share sends the file with the caption as text; Copy caption is offered beside it, and tapping Share also copies the caption first, with a note "Caption copied — paste it on your Status" | Claude · reversible | 2026-11-06 | The share sheet drops text for some apps; a copied caption always survives | decided |
| Q3 | What if the phone cannot share files (desktop, old browser)? | Download image and Copy caption, with "Open this on your phone to share it to Status" | Claude · reversible | 2026-11-06 | Web Share with files is phone-only; never a dead button (ADR-0053) | decided |
| Q4 | When is a Status destination Published? | When the shop taps "I've posted it", after sharing. Until then it stays Ready for Status | Claude · reversible | 2026-11-06 | We cannot see WhatsApp; the shop's word is the only signal, and pretending otherwise would lie | decided |
| Q5 | Does a Ready for Status expire? | After 24 hours unposted it reads "Not posted · was due <time>", still shareable, with Mark as skipped | Claude · reversible | 2026-11-06 | A Status lasts 24h; an old one should not nag, but nothing is lost | decided |
| Q6 | What size is the image? | 1080×1920 (9:16) JPEG made from the library asset, fitted without cropping on a plain background when the photo is not portrait | Claude · reversible | 2026-11-06 | WhatsApp Status's full-screen shape; JPEG shares everywhere | decided |
| Q7 | Does the kit need WhatsApp connected? | No: it works for any shop. It shows as a destination whether or not connect-whatsapp is done | Claude · reversible | 2026-11-06 | The share goes from the shop's own phone | decided |
| Q8 | Is the "post due" event sent once per destination or per post? | Once per post at its time, naming every handoff due; post-scheduling's own "post failed" covers failures | Claude · reversible | 2026-11-06 | One nudge, not one per box ticked | decided |

## Parked (Later)
None.

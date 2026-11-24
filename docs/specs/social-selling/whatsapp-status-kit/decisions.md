# Decisions — social-selling/whatsapp-status-kit

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q18, Q26, Q51, Q66.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q2 | How do the file and caption reach the phone? | The image is a 1080×1920 (9:16) JPEG made from the library asset, fitted without cropping on a plain background when the photo is not portrait. Share sends the file with the caption as text, and copies the caption first ("Caption copied — paste it on your Status"), since some phones drop shared text; Copy caption sits beside it. Where the device cannot share files (desktop, old browsers) it offers Download image and Copy caption, with "Open this on your phone to share it to Status" | Claude · reversible | 2026-11-06 | The share sheet drops text for some apps; a copied caption always survives | decided |
| Q4 | When is a Status done, and what if it is not? | At the post's time one "post due" event goes to notifications, naming every handoff due (failures are post-composer's "post failed"). The destination stays Ready for Status until the shop taps "I've posted it" after sharing; after 24 hours unposted it reads "Not posted · was due <time>", still shareable, with Mark as skipped | Claude · reversible | 2026-11-06 | We cannot see WhatsApp; the shop's word is the only signal, and pretending otherwise would lie | decided |
| Q7 | Does the kit need WhatsApp connected? | No: it works for any shop. It shows as a destination whether or not connect-whatsapp is done | Claude · reversible | 2026-11-06 | The share goes from the shop's own phone | decided |
| Q9 | How does a due Status reach the shop on time, before in-app or push alerts exist? | Recommended: notifications-core sends an email at the due minute, beside the badge, for this one alert (the daily email is too late for a timed post); push replaces it when the hub gains push | Owner | — | A Status planned for 6pm is useless at 9am the next day | open |

## Parked (Later)
None.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → parent Q18 · Q3 → Q2 · Q5 → Q4 · Q6 → Q2 · Q8 → Q4

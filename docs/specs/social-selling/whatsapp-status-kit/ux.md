# UX — social-selling/whatsapp-status-kit

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../post-scheduling/prototype.html](../post-scheduling/prototype.html), journey 3. Open locally; artifact publishing was unavailable in this session
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [post-scheduling ux](../post-scheduling/ux.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Every string below is the string that ships.

## Journeys
1. **Share on time.** Notice "Your post is ready to share to WhatsApp Status." (badge on Posts and
   the day's email, through notifications) → the post → Share to Status → caption copied, the phone's
   share sheet opens → WhatsApp or WhatsApp Business → My Status → paste caption → post → back →
   I've posted it → Posted.
2. **Not today.** Mark as skipped → Skipped.
3. **Forgot.** A day later the row reads "Not posted · was due <day, time>", still shareable.
4. **On a computer.** Download image and Copy caption, with "Open this on your phone to share it
   to Status."

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Composer destination | post-scheduling's composer, "WhatsApp Status · you share it from your phone" | Changed | R1 |
| Status share block | post-scheduling's post page, WhatsApp Status row when ready | New | R3–R6 |

## State matrix — WhatsApp Status row
| State | What the person sees | Action |
|---|---|---|
| First use | The hint under the block: "WhatsApp doesn't let apps post a Status. Share opens WhatsApp with the picture; your caption is copied to paste." | Share to Status |
| Empty | n/a — a row exists only once a post picks Status | — |
| Loading | 9:16 placeholder while the picture loads; Share shows "Preparing…" until the file is ready | — |
| Partial | n/a — one picture or video per Status | — |
| Success | After Share: "Caption copied — paste it on your Status." After I've posted it: chip "Posted", "You posted it at <time>" | — |
| Retryable error | Picture failed to load: "Couldn't load the picture. Check your connection and try again." | Try again |
| Terminal error | n/a — the picture was made at the post's time; a removed photo fails as in post-scheduling | — |
| Refused | Device can't share files: Download image + Copy caption + "Open this on your phone to share it to Status." | Download image |
| Stale | Over 24 h unposted: "Not posted · was due <day, time>" | Share to Status · Mark as skipped |
| Long content | Caption shown in full under Copy caption, scrolls after 6 lines | — |
| Many items | n/a | — |
| Slow | "Preparing…" on Share up to the file download | — |
| Phone / tablet / desktop | Share primary / Share if the device can, else Download (`md:`) / Download + Copy (`lg:`) | — |

## Copy deck
- Notice: "Your post is ready to share to WhatsApp Status." (sent by notifications).
- Buttons: "Share to Status", "Copy caption", "Download image", "I've posted it", "Mark as skipped",
  "Try again". Chips: "Ready for Status", "Posted", "Skipped".
- Notes: "Caption copied — paste it on your Status.", "Posted it on WhatsApp?",
  "You posted it at <time>", "Not posted · was due <day, time>",
  "Open this on your phone to share it to Status."

## Sign-off
Awaiting the owner's review of the prototype.

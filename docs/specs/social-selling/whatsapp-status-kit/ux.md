# UX — social-selling/whatsapp-status-kit

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/post.html](../prototypes/post.html), section "Status, on time"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), [post-composer ux](../post-composer/ux.md), [notifications-core ux](../../notification-hub/notifications-core/ux.md)

> WhatsApp lets no app post a Status, so this is a handoff, honest about it: at the time the shop is
> told, one tap opens WhatsApp with the picture and the caption on the clipboard, and one more says
> it is done. The handoff page is built for the phone in the shop owner's hand at 6 pm.

## Journeys
1. **On time, on the phone.** 6:00 pm: email "Your Status is ready to post" (push later, Q9) → tap →
   **Status handoff** page: the picture at 9:16, the caption, **Share to Status** → (caption copied
   first, toast "Caption copied — paste it on your Status") → the phone's share sheet → WhatsApp →
   My status → paste, post → back in the browser the page now leads with **I've posted it** →
   tap → "Posted to your Status" and the post's destination turns Published.
2. **Several due at once.** The email names each; the handoff page steps through them: "1 of 2",
   **Next** after "I've posted it".
3. **On a computer.** The handoff page shows a QR code "Open this on your phone" beside **Download
   picture** and **Copy caption** (R4). Scanning opens the same page on the phone.
4. **Missed it.** After 24 h the destination reads "Not posted · was due Fri 6:00 pm"; the handoff
   still works; ⋯ → **Mark as skipped**.
5. **From Posts.** A Ready for Status row's badge is a button: **Share** opens the handoff page.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Status destination chip | Composer, Where | New | R1 |
| Status handoff | `/org/[orgId]/posts/[postId]/status`: full page on a phone, `HandoffSheet` over the post on a computer | New | R2–R6 |
| Due alert | Email through notifications-core | New | R2 |

## State matrix — Status handoff
| State | What the shop sees | Action |
|---|---|---|
| First use | A one-time line under the button: "WhatsApp opens with your picture. Your caption is copied: paste it before posting." | Share to Status |
| Ready | Picture 9:16, caption in a box with **Copy caption** | Share to Status |
| Sharing | Button pending "Opening WhatsApp…" (the share sheet) | — |
| Back from sharing | The page leads with **I've posted it**; **Share again** becomes secondary | I've posted it |
| Success | "Posted to your Status" with a tick; the post detail shows Published (marked by you) | Back to posts |
| Retryable error | Share sheet cancelled: no change, Share to Status stays primary | Share to Status |
| Refused | Device can't share files: Download picture and Copy caption shown instead, with the QR | Download picture |
| Stale | Over 24 h: "Not posted · was due <time>"; Share still works | Share · Mark as skipped |
| Loading | Picture skeleton at 9:16 while the rendition is made | — |
| Long content | Caption box scrolls after 6 lines; Copy caption always visible | — |
| Many items | "1 of 3" stepper, Next | Next |
| Phone / tablet / desktop | Phone: full page, buttons at the thumb. Desktop: sheet with the QR code first | — |

## Copy deck
- Destination chip "WhatsApp Status"; under it once: "We'll get it ready on your phone at the time; you post it with one tap."
- Email subject "Your Status is ready to post"; body "<n> Status due now. Open on your phone to post." Button "Open".
- "Share to Status" → "Opening WhatsApp…"; toast "Caption copied — paste it on your Status".
- "I've posted it" → "Posted to your Status"; "Share again"; "Copy caption" → "Copied"; "Download picture".
- "Open this on your phone"; "Not posted · was due <time>"; "Mark as skipped" → toast "Marked as skipped."

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../ux-review.md)) and the final cross-feature check.

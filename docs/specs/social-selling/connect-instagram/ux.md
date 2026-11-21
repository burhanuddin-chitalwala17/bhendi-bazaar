# UX — social-selling/connect-instagram

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [connect-instagram/prototype.html](../connect-instagram/prototype.html) (local file; to be published as a private artifact)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [channel-connectors ux.md](../../marketplace-integration/channel-connectors/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships. The Channels page, its outcome note, disconnect
> dialog and dashboard banner are channel-connectors'; this adds one card and its outcomes to them.

## Journeys
1. **Connect.** Shop menu → Channels → Instagram card → Connect Instagram → Instagram's own page
   (sign in if needed, Allow) → back on Channels, card Connected with `@handle`, toast
   "Instagram connected."
2. **Personal account.** Same start → Instagram allows → we find a personal account → back on
   Channels with "Switch to a professional account" steps → the shop switches in the Instagram app →
   Try again → journey 1.
3. **Cancel or fail.** The shop taps Cancel on Instagram, the link expired, or Instagram does not
   answer → back on Channels with a note and Connect Instagram again.
4. **Refused.** The account is in another shop, or a reconnect used a different account → the
   reason; nothing connected.
5. **Kept alive.** Nobody acts; the daily pass renews. If it cannot, or the shop removed Bhendi
   Bazaar inside Instagram → card and dashboard "Instagram needs reconnecting" → Reconnect →
   journey 1, same account.
6. **Disconnect.** Card → Disconnect → dialog → Disconnect → card Not connected.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Instagram card | Channels, `/org/[orgId]/channels`, after Meta catalogue (Q13) | New, replaces the Coming soon Instagram card | R1, R3, R7, R12 |
| Meta feed card | Channels | Changed: titled "Meta catalogue" (Q13) | Q13 |
| Return outcome note | Top of Channels | Changed: Instagram outcomes added | R2–R4 |
| Professional-account steps | Inside the outcome note, expandable | New | R3 |
| Disconnect dialog | Over Channels | Changed: Instagram wording | R10 |
| Dashboard banner | `/org/[orgId]` | Changed: Instagram counted | R9 |

## State matrix — Instagram card
| State | Chip | Body | Primary action |
|---|---|---|---|
| First use (not connected) | Not connected | "Post, reply to comments and answer DMs from here. Needs an Instagram business or creator account." | Connect Instagram |
| Redirecting | — | Button spinner, "Opening Instagram…" | — |
| Connected | ● Connected | "@bhendibazaar.official · Business" · "Connected by Farida · 6 Nov 2026" · "Last checked 2 min ago" | Disconnect (secondary, red text) |
| Needs reconnecting | Needs reconnecting | One of: "Instagram stopped accepting our access." · "Bhendi Bazaar was removed in Instagram's settings." | Reconnect · Disconnect (secondary) |
| Disconnected (before) | Not connected | "Disconnected by Farida · 6 Nov 2026." | Connect Instagram |
| Coming soon (switch off) | Coming soon | "Connecting Instagram isn't open yet. We'll show it here when it is." | Why? (explains) |
| Empty | n/a — the card is the empty state | — | — |
| Partial | n/a — one account, connected or not | — | — |
| Retryable error | Shown as the return note | — | — |
| Terminal error | Shown as the return note (personal account) | — | — |
| Refused | Shown as the return note (other shop, different account) | — | — |
| Stale | "Last checked 3 days ago" turns amber past 24 h | — | Check now |
| Long content | A 30-character handle truncates on one line; tap shows it in full | — | — |
| Many items | n/a — one Instagram account per shop | — | — |
| Slow | "Opening Instagram…" past 3 s adds "Still working…" | — | — |
| Phone / tablet / desktop | Same card as the marketplaces': actions full width on phone, inline from `md:` | — | — |

## State matrix — Return outcome note (Instagram)
| Outcome | Tone | Text | Action |
|---|---|---|---|
| Connected | Success toast | "Instagram connected." | — |
| Personal account (R3) | Warning note | "That's a personal Instagram account. Bhendi Bazaar works with business and creator accounts, which are free. In Instagram: Profile → ☰ → Account type and tools → Switch to professional account." | Try again |
| Cancelled | Neutral note | "Nothing was connected. You can connect Instagram any time." | Connect Instagram |
| Link expired or altered | Warning note | "That link has expired. Start again from here." | Connect Instagram |
| Started by someone else | Warning note | "This connection was started from another sign-in. Start again from here." | Connect Instagram |
| Account in another shop (Q4) | Error note | "This Instagram account is already connected to another shop. An account can belong to one shop only; disconnect it there first." | — |
| Different account on reconnect (Q4) | Warning note | "That's a different Instagram account from the one connected here. To switch accounts, disconnect this one first, then connect the new one." | Disconnect |
| Instagram did not answer | Error note | "Instagram didn't respond. Nothing was connected. Try again in a minute." | Try again |
| Not open (parent Q2) | Neutral note | "Connecting Instagram isn't open yet." | — |

## State matrix — Disconnect dialog (Instagram)
| State | What the person sees | Action |
|---|---|---|
| Default | Title "Disconnect Instagram?" · **Stops:** "Scheduled posts won't publish, and new comments and DMs stop arriving here." · **Stays:** "Your posts on Instagram stay as they are. Your conversations stay here for 90 days, then are deleted." · "To remove us completely, also remove Bhendi Bazaar in Instagram: Settings → Website permissions → Apps and websites." | Disconnect · Keep connected |
| Working | "Disconnecting…" | — |
| Success | Dialog closes; card Not connected; toast "Instagram disconnected." | — |
| Retryable error | "Couldn't disconnect. Try again." | Try again |
| Phone / tablet / desktop | Bottom sheet on phone; dialog from `md:` (ADR-0040) | — |

## State matrix — Dashboard banner (Instagram)
| State | Text | Action |
|---|---|---|
| None | No banner | — |
| Needs reconnecting | "Instagram needs reconnecting. Posts won't publish until it is." | Reconnect |
| With another channel | channel-connectors' "2 channels need attention." | Open Channels |

## Copy deck
Every string above ships as written. Card title "Instagram"; the feed card becomes "Meta catalogue",
line "Your products in Facebook and Instagram shops, from your catalogue feed." (Q13). Check now
answers "Checked just now. All good." / "Instagram needs reconnecting." / "Instagram didn't respond.
Try again in a minute." Words: an account is "connected", never "linked"; the account type reads
"Business" or "Creator"; handles always carry "@".

## Sign-off
Awaiting the owner's review of the prototype.

# UX — social-selling/connect-instagram

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/connect.html](../prototypes/connect.html), sections "Instagram"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), the shipped Channels page (`channel-copy.ts`), [channel-connectors](../../marketplace-integration/channel-connectors/)

> The Instagram card on Channels, built on the existing channel card, its return note and its
> disconnect dialog. New here: the setup checklist (parent Q111) and the message-access step (Q16).

## Journeys
0. **Before Instagram's page.** Under **Connect Instagram** one calm line: "Instagram will ask to
   let Bhendi Bazaar manage messages. That's what lets you reply from here. Your chats stay between
   you and your buyers." Shown once, before the shop meets Meta's own wording.
1. **Connect.** Channels → Instagram card → **Connect Instagram** (pending: "Opening Instagram…") →
   Instagram's own page: sign in, Allow → back on Channels: the return note "Instagram connected."
   and the card Connected, its checklist showing **Turn on replies** as the next step.
2. **Turn on replies.** Card → **Turn on replies** → a `HandoffSheet` with the three taps and
   **Open Instagram** (opens the app's settings page where the phone allows it) → the shop allows
   it in Instagram → back on the card the step stays "Waiting for your first message" until one
   arrives, then ticks itself (Q16). A line under the step helps it along: "To check it now, send
   @niqab.boutique a DM from another account."
3. **Finish setup.** The checklist's next steps, **First post** (opens the composer; when posts are
   already waiting under Saved, the step reads "3 posts waiting · Post them" and opens Saved instead) and
   **Comment-to-DM** (opens the composer's panel), each return to the card ticked. All ticked:
   "Setup done" folds the list and the card shows health only.
4. **Personal account.** Same start → Instagram allows → back on Channels with the note "That's a
   personal account" and the three steps to switch for free → **Try again** → journey 1.
5. **Something goes wrong.** Cancelled on Instagram, link expired, account in another shop, a
   different account on reconnect, Instagram not answering: each a return note, nothing connected.
6. **Kept alive.** Nobody acts. If renewal fails or Bhendi Bazaar is removed inside Instagram, the
   card turns Needs reconnecting and Home shows it once → **Reconnect** → journey 1, same account.
7. **Disconnect.** Card → **Disconnect** → dialog lists what stops and what stays → **Disconnect**
   (pending: "Disconnecting…") → card Not connected, toast "Instagram disconnected."

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Instagram card | Channels, "Where you sell", after Meta catalogue | New (replaces the Coming soon card once open) | R1, R3, R6, R7, R12 |
| Return note | Top of Channels | Changed: Instagram outcomes | R2–R4 |
| Turn on replies sheet | `HandoffSheet` over Channels | New | R6 |
| Disconnect dialog | Over Channels | Changed: Instagram wording | R10 |
| Home attention line | Home | Changed: Instagram counted | R9 |

## State matrix — Instagram card
| State | Badge | Body | Main action |
|---|---|---|---|
| First use (not connected) | Not connected | "Post, answer comments and DMs, and turn comments into sales. Needs an Instagram business or creator account (free to switch)." | Connect Instagram |
| Connecting | Not connected | Button pending "Opening Instagram…"; past 3 s "Still working…" | — |
| Connected, setup open | ● Connected | "@niqab.boutique · Business" + checklist: Connect ✓ · **Turn on replies** · First post · Comment-to-DM | Turn on replies |
| Waiting for a message | ● Connected | Checklist step "Turn on replies · waiting for your first message" (dashed tick) | First post (next) |
| Message access off (Meta said so) | Needs you | "Replies from here are off in Instagram. Switch them back on to answer DMs here." | Show me how |
| Setup done | ● Connected | "@niqab.boutique · Business" · "Connected by Farida · 22 Nov 2026" · "Last checked 2 min ago"; "Setup done" | Disconnect (secondary, red) |
| Needs reconnecting | Needs reconnecting | "Instagram stopped accepting our access." or "Bhendi Bazaar was removed in Instagram's settings." | Reconnect · Disconnect (secondary) |
| Empty | n/a — the card is the empty state | — | — |
| Loading | Part of the Channels skeleton, card in place | — | — |
| Partial | Setup part-done: ticked steps dim, the next bold | — | The next step |
| Retryable error | Shown as the return note | — | — |
| Terminal error | Personal account, shown as the return note | — | — |
| Refused | Account in another shop / different account; or no Social selling lock (lock on Connect) | — | — |
| Stale | "Last checked 3 days ago" in amber | — | Check now (pending "Checking…", then "Checked just now. All good.") |
| Long content | A 30-character handle truncates on one line; tap shows it whole | — | — |
| Many items | n/a — one account per shop | — | — |
| Slow | "Opening Instagram…" + "Still working…" after 3 s | — | — |
| Phone / tablet / desktop | Phone: actions full width at the card's foot; `md:` two cards across, actions inline; `lg:` three across | — | — |

## State matrix — Return note (Instagram)
| Outcome | Tone | Text | Action |
|---|---|---|---|
| Connected | success | "Instagram connected. Next: turn on replies, so you can answer DMs from here." (with saved posts, a second line: "3 posts are waiting for Instagram." · See them) | Turn on replies |
| Personal account | warning | "That's a personal Instagram account. Bhendi Bazaar works with business and creator accounts, which are free. In Instagram: Profile → ☰ → Account type and tools → Switch to professional account." | Try again |
| Cancelled | neutral | "Nothing was connected. You can connect Instagram any time." | Connect Instagram |
| Link expired or altered | warning | "That link has expired. Start again from here." | Connect Instagram |
| Another shop's account | error | "This Instagram account is already connected to another shop. An account can belong to one shop only; disconnect it there first." | — |
| Different account on reconnect | warning | "That's a different Instagram account from the one connected here. To switch, disconnect this one first, then connect the new one." | Disconnect |
| Instagram didn't answer | error | "Instagram didn't respond. Nothing was connected. Try again in a minute." | Try again |

## Copy deck
- Card title "Instagram"; purpose line "Post, answer comments and DMs, and turn comments into sales."
- Checklist: "Connect" · "Turn on replies" · "First post" · "Comment-to-DM"; waiting line "waiting for your first message"; folded "Setup done".
- Turn on replies sheet: title "Turn on replies from Bhendi Bazaar"; body "So you can answer your DMs here, Instagram asks you to switch this on once, in the app:"; foot "🔒 Private to your shop · No one at Bhendi Bazaar reads your chats." (opens the privacy sheet, inbox-core); steps "1. Settings → Messages and story replies", "2. Message controls → Connected tools", "3. Turn on Allow access to messages"; actions "Open Instagram", "Done".
- Disconnect dialog: title "Disconnect Instagram?"; "Stops: scheduled posts won't publish, and new comments and DMs stop arriving here." "Stays: your posts on Instagram stay as they are. Your conversations stay here for 90 days, then are deleted." "To remove us completely, also remove Bhendi Bazaar in Instagram: Settings → Website permissions → Apps and websites." Buttons "Disconnect", "Keep connected"; toast "Instagram disconnected."
- Home line: "Instagram needs reconnecting. Posts won't publish until it is." · Reconnect.

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.

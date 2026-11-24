# UX review — social selling and its siblings

- **Verified:** 2026-11-22
- **Covers:** every ux.md and prototype written for social-selling, notification-hub, bulk-publish, checkout-links and ai-images/social-posts
- **References:** [ux-patterns.md](ux-patterns.md), [spec.md](spec.md), prototypes in [prototypes/](prototypes/), [published](https://claude.ai/artifact/6Yqg4xgjp3mDRXYDVsVtwU) (all eight, linked to each other)

> A senior product and UX pass over the whole set, read as one product: does a shop know where it
> is, what each button will do, and what happened, without a wasted tap? Fixes were applied in place
> (listed below). Four questions need the owner; everything else follows the specs as decided.

## What holds across the set
- **One way in, one way back.** Every setup step opens from the channel card's checklist and returns
  there ticked; every Home figure and bell item opens its screen filtered (ux-patterns §5, §6).
- **Buttons say what they are doing.** Pending verbs everywhere ("Scheduling…", "Opening Meta…",
  "Sending…"), past-tense toasts, nothing disabled; refusals explain on tap and scroll to the field.
- **Money before spending.** Every paid send shows "about ₹x" first and names it on the button;
  spend against the limit is on Messaging, the review sheet and Home.
- **Honesty where a platform cannot.** Status is a handoff marked done by the shop's own tap; the
  reply box states the platform's window before a send can fail; uploads opt nobody in without a
  recorded tick.
- **Reuse over invention.** The Settle screen, Improve with AI, readiness-fix pages, the listing
  details panel and the lock sheet are reused with their words; new screens use the page grammar.

## Fixes applied in this pass
| # | Finding | Fix |
|---|---|---|
| 1 | The phone tab bar already has five slots (Home, Products, Orders, Earnings, More); "Inbox takes a tab-bar slot" had no room | Inbox takes Earnings' slot when social selling is on; Earnings moves to More (ux-patterns §1). **Owner question 1** |
| 2 | A new "Social" sidebar group would be a sixth group | The three items join the existing Grow group after Channels |
| 3 | The composer pre-ticked every connected destination, so a first post could also go out as an unintended story | Pre-ticks the last post's destinations; the first time, Instagram post and Status only |
| 4 | "usually within 2 hours" promised a reply time the shop never set | "will reply as soon as they can", or "from 10 am" outside hours |
| 5 | Product answers and comment rules had no clear relation to the Auto-replies switch | One top switch; each part has its own, on by default |
| 6 | Consent badges relied on colour (green/red dot) | Status word always shown; new ux-patterns §12 on accessibility (live regions, focus, no swipe-only actions) |
| 7 | "Allow messages" waits for a first DM, which a quiet account may never get | A hint to send a test DM from another account |
| 8 | The spending-limit sheet preselected ₹1,000 without saying why | Marked "Suggested" |
| 9 | Inbox switched platform tabs by itself | Opens on the last tab used, unless only another has something needing the shop; each tab shows its own count |
| 10 | The cost example in ux-patterns §7 dropped "about" on an estimate; the spend card said 246 messages left for ₹788 | "about" on every estimate; 916 left (₹788 ÷ ₹0.86) |
| 11 | Plan lock copy differed from feature-access | "Social selling is part of the ₹699 plan" · Talk to us, as feature-access ships |
| 12 | Routes for Messaging and Notification settings sat outside Shop details' path | `/org/[orgId]/shop/details/messaging` and `/notifications` |

## Questions for the owner
1. **Phone tab bar.** With social selling on, Inbox replaces Earnings in the tab bar (Earnings
   moves to More). Applied as the default; the alternative is Inbox only in More, one tap further
   for the screen a shop opens most.
2. **The checkout consent box** names the shops and Bhendi Bazaar in one tick (audience Q8). India's
   DPDP Act asks consent to be specific to each purpose; two ticks ("offers from <shop>" and "offers
   from Bhendi Bazaar") are safer and cost one line. Keep one, or split?
3. **A caption whose price went stale.** The shop is warned before the post goes out
   (ai-images Q47). If it does nothing, the post publishes with the old price. Publish anyway
   (current), or hold that destination as "Check price" until the shop taps Update price or Publish
   as is?
4. **Comment-to-DM on by default** when a post names a product. It sends DMs to anyone commenting
   the keyword, which is the point, but it is automatic behaviour the shop did not switch on.
   Keep it on by default, or off until the shop turns it on in the panel?

## Owner's answers (2026-11-23)
1. Yes: Inbox takes Earnings' slot (parent Q115).
2. Keep one box, naming both consents explicitly (audience Q8, replaced in place).
3. Hold it: "Check price" until the caption is updated or Publish as is is tapped (ai-images Q47, replaced in place).
4. Yes, on by default (comment-automations Q12).

## Smaller notes, left as designed
- An "All" inbox tab across platforms would save a tap for shops with both; the spec keeps a tab
  per platform (inbox-core R1). Worth revisiting after use.
- Desktop inbox has three panes from `xl:`; tablets get two. Checked against ADR-0050's breakpoints.
- Every prototype string is the one that ships; copy modules come at build (ADR-0067).

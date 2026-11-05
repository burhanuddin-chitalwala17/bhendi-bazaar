# UX — setup-requests

- **Status:** Signed off
- **Verified:** 2026-11-05
- **Prototype:** [prototype.html](prototype.html) (local file; publishing as an artifact needs a claude.ai login in this session)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), marketplace-publish [ux.md](../marketplace-integration/marketplace-publish/ux.md) (Q24 How to fix it, Q25 Pending)

> Phone first (~360px). Buttons are never disabled (ADR-0053). A requirement never shows the shop a
> step, nor the admin a shop (Q3). States are few and mean something (Q31); how a screen loads,
> wraps or lays out is written once under each screen as behaviour, never as a state.

## The states (Q31)
The shop reads two lines together: where the listing stands on Amazon, and, only while something is
on us, where our ticket stands.

| Listing (Amazon) | Means |
|---|---|
| Draft | Not sent yet |
| Pending | Sent; waiting for Amazon's answer. We poll it (Q30) |
| Live | Amazon accepted it |
| Needs attention | Amazon refused it; the reasons and how to fix them show below |

| Ticket (shop) | Means | Action |
|---|---|---|
| With us | We're on it: a requirement raised by itself, or an issue the shop reported | — |
| Ready | Done on our side; fill what's named and send again | Fill on product |
| Not supported yet | The admin said Not now (Q11) | — |

| Ticket (admin) | Means | Action |
|---|---|---|
| Open | Waiting for the admin; "Reopened" when the same error came back after it was done (Q12) | Apply, or Mark fixed |
| Done | The setup exists, or the issue is marked fixed | — |
| Closed | Not now, or no shop needs it any more (Q13) | — |

## Journeys
1. **Amazon wants fields we don't ask (shop).** Create on Amazon → Pending → Needs attention, and How
   to fix it says "Amazon also needs 15 details we don't ask for yet: …" with **With us** (raised by
   itself, Q5) → after journey 2, **Ready** + Fill on product → the shop fills them, sends again →
   Pending → Live.
2. **Apply fields, one tap (admin).** Sidebar "Requests 3" → "Amazon fields for TOTE_BAG · 2 shops
   waiting" → each field with our proposed name (renamable, Q15) and Amazon's answers, read through
   Niqab Boutique (Q14) → "What Apply does" → Apply 15 fields → Done.
3. **Choose a category, a decision (admin).** "81 have no Amazon category" raised the ticket by itself
   → admin picks one of Amazon's matching types (Q29) → Apply → the rows lose "No Amazon category".
4. **Report an issue (shop → developer).** Needs attention, with an error no kind explains → Report this
   → category picked, error attached → the shop writes a line → Send → **With us** → a platform admin
   sees shop, product, words and error (Q22, Q26) → Mark fixed → the shop sees **Ready**.
5. **Not now (admin → shop).** Not now, confirmed in place → the shop sees **Not supported yet**.

## Screens
| Screen | Route | Reached from | Serves |
|---|---|---|---|
| Listing, How to fix it (changed) | `/org/{org}/products/{id}/listings/{channel}` | product's On marketplaces, Listings row Fix | R2, R4, R8 |
| Products list row chip (changed) | `/org/{org}/products?channel=amazon` | Products | R4 |
| Channels, Your requests + Report a problem (changed) | `/org/{org}/channels` | sidebar Channels | R4, R8 (Q25) |
| Report a problem sheet (new) | over the listing or Channels | Report this, Report a problem | R8 |
| Requests inbox and detail (new) | `/admin/requests`, `/admin/requests/{id}` | admin sidebar Requests | R3, R5, R6, R7 |

## Each screen: what it shows, and how it behaves
| Screen | Shows | Behaviour |
|---|---|---|
| Listing, How to fix it | The listing state on top. Under How to fix it: the shop's own fixes (marketplace-publish Q24), then one ticket line with its chip; an unexplained error with Report this | One column; names wrap, past 6 "and {n} more". A failed raise says "Couldn't send the request." with Try again |
| Products list | The listing state as today; a ticket chip beside "to fix" while one is open | Rows on a phone, table from `md:` |
| Channels, Your requests | The shop's tickets, newest first, each with its chip; Report a problem | Empty: "Nothing with us. If something only we can fix holds up a listing, it shows here." 25 then Show more |
| Report a problem | About (category, Q23), What happened (Q27), what's sent with it | Sheet on a phone, dialog from `md:`. Empty words: "Say what happened in a line or two." Failed send keeps the words |
| Requests inbox | Requirements and Issues tabs; each row: the setup, "{n} shops waiting" over one (Q4), age | Most shops first, then oldest; 25 a page; search (Q28). Empty: "Nothing waiting." Skeleton while loading |
| Requirement detail | One tap: each field, our proposed name, Amazon's answers. Decision: Amazon's types to pick. Both: "What Apply does", Apply, Not now | Previews read through Niqab Boutique; not connected says so and links the channel register. Amazon busy: Try again. Changed since opened, or already set up: says so, writes nothing |
| Issue detail | Category, shops, first seen; each report's shop, product, words; Amazon's error | Mark fixed |

## Copy deck
- Listing states: "Draft · not on Amazon yet" · "Pending · waiting for Amazon's answer" · "Live on Amazon" · "Needs attention · {n} problem(s)".
- Ticket chips (shop): "With us" · "Ready" · "Not supported yet".
- Shop lines: "Amazon also needs {n} details we don't ask for yet: {names}." · "Fill these on the product: {names}." · "We can't set up {names} for Amazon yet. Amazon may keep refusing this listing until we do." · "Amazon found a problem we don't recognise" · "Tell us what happened and we'll fix it." · "Report this" · "Report a problem" · "About" · "What happened" · "Sent with it: {product} on {Marketplace}, and {Marketplace}'s message." · "Send report" · "Sent. It's with us; we'll tell you here when it's ready." · "Couldn't send the request." · "Couldn't send your report. Your words are kept."
- Categories (Q23): "Listing on a marketplace" · "Stock on a marketplace" · "Marketplace orders" · "Something else".
- Channels: "Your requests" · "Nothing with us. If something only we can fix holds up a listing, it shows here."
- Admin: "Requests" · "Requirements" · "Issues" · "{n} shops waiting" · "Open" · "Reopened" · "Done" · "Closed" · "Read from Amazon through Niqab Boutique · {ago}" · "What Apply does" · "Apply {n} fields" · "Apply {type}" · "Pick one of Amazon's types first." · "Not now" · "Keep it" · "Shops waiting will see it isn't supported yet." · "Applied. {n} shops can now fill them." · "Already set up. Nothing to do." · "Amazon's fields changed since you opened this. Here's the new list." · "Connect Niqab Boutique to Amazon to see Amazon's fields, or set it up in the channel register." · "Couldn't reach Amazon. Try again." · "Mark fixed" · "Nothing waiting."

## Sign-off
Signed off by the owner, 2026-11-05 ("signed off"), on the prototype with the minimal states (Q31) and Pending (marketplace-publish Q25).

# Spec — setup-requests

- **Summary:** Two tickets for what a shop can't fix itself: a requirement, raised by the app and enabled by the admin with one tap or one decision; an issue, written by the shop under a category and fixed by a developer
- **Status:** Implemented
- **Domain:** cross-domain: listing (the setup), channels (the errors), a new home for requests
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-05
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), marketplace-publish [Q24](../marketplace-integration/marketplace-publish/decisions.md), [channel-registry](../channel-registry/spec.md), [ADR-0053](../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
Two tickets for what a shop cannot fix itself. A **requirement** is a known problem with a known
solution the platform only needs to enable (a field we don't ask for, a category with no Amazon
type). The app raises it from the error, and the admin enables it with one tap or by picking one of
the options offered. An **issue** is something no admin action can resolve: the shop describes it in
its own words under a category, and a developer fixes it. Once resolved, every shop waiting sees it.

## Why
On 2026-11-05 a Tote bag drew twenty "required but missing" complaints from Amazon, fifteen of them
fields the shop cannot fill because we never ask them, and 81 products had no Amazon category. The
shop's only path was "Ask the admin" by WhatsApp; the admin then had to work out the fix by hand.
The same setup serves every shop that sells that type, so it should be asked for once, fixed once,
and reach all of them (Q9).

## Requirements
- R1 — A ticket is a **requirement** of a closed set of kinds, each mapped to its solution, or an
  **issue** (Q21). This feature's requirement kinds are two (Q10): **Amazon fields** for an Amazon
  type, and an **Amazon category** for one of our product types.
- R2 — A request is raised from an error the app already sees, without the shop asking (Q5): the
  products list's readiness, a draft check, a send's answer, the daily problems look. "Request it"
  raises the same request by hand where "Ask the admin" is offered today.
- R3 — Every shop needing the same setup joins one request (Q9); a second shop never makes a second.
- R4 — The shop sees what it needs and where it stands, never the steps (Q3), in three words for
  any ticket (Q31): **With us**, **Ready** (fix the product and send again), **Not supported yet** (Q11).
  Beside it, the listing's own state: Draft, Pending, Live or Needs attention (marketplace-publish Q25).
- R5 — The admin sees the setup that fixes it, the steps written out, and Apply, or the options to
  choose from and Apply (Q6); never which shops, products or complaints (Q3). "3 shops waiting"
  shows only when more than one waits (Q4). Options and previews read Amazon through Niqab
  Boutique's connection, never another shop's (Q14).
- R6 — Apply writes the whole fix or nothing, and only on the admin's tap (Q6).
- R7 — A requirement is done when the setup exists, however it was made (Q8); an issue when the
  developer marks it fixed (Q22). The same error after either reopens it (Q12); one no shop needs any
  more closes (Q13).
- R8 — An issue is the shop's own words under a category (Q7, Q23). An error no requirement kind
  explains offers "Report this" with its category picked and the error attached; a shop can also
  report one with no error (Q24). The developer sees the shop and the product, issues only (Q22).
- R9 — Nothing here stops a product being saved or listed (ADR-0053).

## Hazards the TRD must answer
- **Two shops, one moment:** two errors for the same setup arriving together must make one request, not two.
- **Two taps:** a double tap on Apply, or two admins, must write the fix once.
- **The preview went stale:** Amazon's definition, or our setup, changed between the preview and Apply.
- **Leaking across the line:** a shop's name, product or complaint reaching the admin's view, or the steps reaching the shop's, is the failure R4 and R5 exist to prevent; it needs an enforcement point, not care.
- **Cost:** the daily look raises requests for every shop; it must stay one read and one write (channels' "a pass over every shop reads once and writes once").
- **The home brand not connected:** Niqab Boutique's connection missing or expired when the admin opens a preview (Q14).

## Product acceptance
- A1 — On a phone, a Tote bag whose draft Amazon refused for 'Strap Type' and 'Style' shows under
  How to fix it "Amazon also needs 15 details we don't ask for yet" with **With us**, and no WhatsApp step.
- A2 — A second shop's Tote bag refused for 'Strap Type' joins the same request; the admin's inbox
  has one row reading "Amazon fields for TOTE_BAG · 2 shops waiting".
- A3 — The admin opens it, sees each field with its proposed question and answers, taps Apply; the
  request shows Done, and the first shop's listing now says "Fill these on the product: Strap type, Style".
- A4 — "Bag has no Amazon type" raises "Amazon category for Bag"; the admin picks one of Amazon's
  suggested types and taps Apply; the 81 products no longer say "No Amazon category".
- A5 — Mapping the same field in the channel register by hand closes the request too (R7).
- A6 — Nothing on the admin's request names a shop or a product; nothing on the shop's names a step.
- A7 — Amazon's "Attribute 'purchasable_offer' does not have the expected value(s)" on a product with
  an MRP shows "Report this" under Listing on a marketplace; the shop adds a line and sends it, and
  sees **With us**. The developer sees the shop, the product, the shop's words and Amazon's error.
  Marking it fixed, then the same refusal, reopens it.

## Scope
- **Outcome:** a listing held up by something only we can fix gets it fixed through a ticket nobody had to write.
- **In:** R1–R9; the two requirement kinds and the issue type; the inbox with Apply and Mark fixed; the shop's ticket state where it already looks (listing, products list).
- **In, from the UX:** the shop's "Your requests" on Channels (Q25); issues on the same admin page (Q26).
- **Later:** value match (Q16), product type (Q17), the bell (Q19), Flipkart and other audiences (Q20).

## Open questions
None.

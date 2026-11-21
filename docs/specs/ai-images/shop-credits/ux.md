# UX — ai-images/shop-credits

- **Status:** Signed off 2026-11-21 (Q31)
- **Verified:** 2026-11-21
- **Prototype:** [published](https://claude.ai/artifact/U3bdiGkYPCKfZdbaihLAE5) · source [../prototype.html](../prototype.html) — journeys 5–8
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md), the payouts "Mark as paid" sheet `src/components/payouts/SettlementList.tsx`

> Phone first. Two audiences: the shop reads its balance and lines; the admin records money and
> sets margins. Money is shown as ₹ with paise; nothing here is editable after it is saved.

## Screens
| Screen | Where | Reached by | Serves |
|---|---|---|---|
| Credits (shop) | A sheet (`HandoffSheet`) from a **Credits** button on the Photos page header | The button; "Add credit" in the AI modal | R1, R8 |
| Payment details (admin) | New `/admin/payment-details` | Admin sidebar | R11 |
| Credits tab (admin) | Admin → Shops → a shop → new **Credits** tab | Admin shop console | R3, R4, R6, R8 |
| Record a top-up | Sheet from the Credits tab | "Record top-up" | R3 |
| Reverse a line | Sheet from a line's menu | "Reverse…" | R4 |
| Shop margin | Inline on the Credits tab | "Change" | R6 |
| AI spend (admin) | Admin → Enhancements: two new figures and a column | — | R8, foundation R11 |
| Mark as paid (payouts) | Today's sheet, with proof fields | "Mark as paid" | R10 |

## Journeys
5. **Shop checks its credit.** Photos → **Credits · ₹2,497.90** → sheet: balance, the note "AI pictures
   are paid from credit, at what each picture costs the platform. To top up, pay by UPI or bank transfer
   below, then send us the payment reference — we add it within a working day.", the QR code, UPI ID and
   bank details with Copy buttons, **Talk to us** → lines, newest first: "AI picture · 21 Nov · −₹2.10",
   "Starting credit · 20 Nov · +₹2,500.00".
5a. **Admin sets the payment details.** Admin → Payment details → UPI ID, QR code (upload), account
   name, account number, IFSC, bank → **Save** → toast "Payment details saved"; the shop sheet shows them.
6. **Admin records a top-up.** Admin → Shops → Niqab Boutique → Credits → **Record top-up** → Amount (₹),
   Method (UPI · Bank transfer · Cash · Other), Transaction reference (required), Paid on (date, today
   by default), Receipt (optional photo) → **Record** → toast "₹1,000.00 added to Niqab Boutique" → the
   line shows "Top-up · UPI · UTR123".
7. **Admin reverses a mistake.** Credits → a line's menu → **Reverse…** → "Why?" (required) → **Reverse**
   → a new line "Reversal of Top-up 21 Nov · −₹1,000.00 · entered twice"; the original stays.
8. **Admin pays a shop out, with proof.** Admin → Payouts → a shop → settlement → **Mark as paid** →
   Method, Transaction reference (now required), Paid on, Receipt (optional) → **Record** → the settlement
   reads "Paid 21 Nov · Bank transfer · UTR987 · receipt".

## Copy (exact)
- Shop page title **Credits** · description "What AI pictures cost, and what is left."
- Balance: "{₹x} left" · low (< ₹50): "Running low — top up to keep making AI pictures"
- Line kinds: "Starting credit" · "Top-up · {method}" · "AI picture" · "Refund — picture not made" ·
  "Reversal of {kind} {date}"
- AI picture line detail (shop): "{₹cost}" ; admin also sees "cost {₹c} · margin {m}%"
- Admin: **Record top-up** · fields "Amount", "Method", "Transaction reference", "Paid on", "Receipt
  (optional)" · reference hint "UTR, cheque or receipt number" · refusal "Add the transaction reference"
- Margin: "Margin on AI pictures: {m}% (platform default)" / "{m}% for this shop" · **Change** · "Back to
  platform default"
- Admin Enhancements figures: "AI spend this month {₹}" · "Absorbed by the platform {₹} ({n} free-tool
  cut-outs past the free allowance)"

## State matrix — Credits (shop)
| State | What the person sees | Action |
|---|---|---|
| First use | Balance ₹2,500.00 and the one "Starting credit" line | How to top up |
| Empty | n/a — every shop has the starting line | — |
| Loading | Balance and list skeletons | — |
| Partial | n/a | — |
| Success | Balance and lines | — |
| Retryable error | ErrorState "Couldn't load your credits" | Try again |
| Terminal error | n/a | — |
| Refused | Not a member: the portal's usual 404 | — |
| Stale | Server-rendered on each visit | — |
| Long content | A long reference wraps under the line | — |
| Many items | `ResourceList`, 30 a page, newest first | Load more |
| Slow | Skeletons | — |

## State matrix — Record top-up (admin)
| State | What the person sees | Action |
|---|---|---|
| First use / Empty | Empty form, Paid on = today | Fill |
| Loading | Button pending | — |
| Success | Toast; line on top | — |
| Retryable error | Inline envelope message | Record again (one request per tap) |
| Terminal / Refused | Missing reference, amount ≤ 0 or above ₹10,00,000: field errors | Fix |
| Stale / Partial / Long / Many / Slow | n/a, or the shared form behaviour | — |

## Decisions confirmed at sign-off
- **U4** — A Credits button on the Photos page opens a sheet; no sidebar item (Q34).
- **U5** — An admin page holds the payment details; the sheet shows them with the note (Q35).
- **U6** — One top-up is capped at ₹10,00,000 (Q36).

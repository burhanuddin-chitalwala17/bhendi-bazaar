# Spec — ai-images/shop-credits

- **Summary:** Each shop has a credit balance kept as a ledger: ₹2,500 to start, offline top-ups the admin records with proof, AI pictures charged at exactly what they cost plus the shop's margin (0% today); payouts gain the same proof
- **Status:** Accepted
- **Domain:** payouts (credit ledger, payment details, proof)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** ux.md, trd.md, [../decisions.md](../decisions.md), [org-payouts](../../org-payouts/), [subscriptions/feature-access](../../subscriptions/feature-access/), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
A shop's AI picture account: what it was given, what it paid in, what each picture cost, and what
is left. Money changes hands outside the platform; the record of it lives here.

## Why
AI pictures cost the platform real money per picture, 20 to 70 times a cut-out. The owner charges
shops exactly that cost (Q2), takes payment offline as the subscription is taken today (Q17), and
may later add a small per-shop margin (Q15). Without one ledger both the owner and the shop are
guessing what was spent.

## Requirements
- **R1** — Every shop has a credit balance. It is the sum of its ledger lines and is never stored or
  typed on its own. Money is integer paise (Invariant 3).
- **R2** — Every shop, existing and new, receives ₹2,500 once, as a line saying so. Never monthly (Q14).
- **R3** — The admin records a top-up for a shop: amount, method (UPI, bank transfer, cash, other),
  transaction reference (required), the date paid, and optionally a picture of the receipt (Q17).
- **R4** — A line is never edited or deleted. A mistake is put right by a reversing line that names
  the line it reverses and why.
- **R5** — An AI picture is charged when the run is asked for: its provider cost and the margin
  applied, both recorded on the line beside the amount charged. A run that fails is refunded by a
  reversing line (Q2, Q20).
- **R6** — Margin is a platform percentage (0% today) and an optional per-shop percentage set by the
  admin; the shop's own wins. Changing it affects only charges made afterwards (Q15).
- **R7** — A shop with less credit than the next picture would cost is refused before anything runs,
  told its balance, and shown how to top up (Q19). It never goes below zero.
- **R8** — The shop sees its balance and its ledger from a **Credits** button on the Photos page (a
  sheet, not a page of its own): each line's date, what it was, and the amount, with a short note on
  why credit exists and how a top-up works, and the platform's payment details (Q34, Q35).
  The admin sees every shop's balance and spend, and the platform's absorbed cost (generation-foundation R11).
- **R9** — Free tools are never charged and never touch the ledger (Q16).
- **R10** — Marking a payout settlement paid requires the same proof: method, transaction reference,
  date paid, optional receipt picture (Q18).
- **R11** — The admin keeps the platform's payment details on a page of their own: a UPI ID, a QR
  code image and a bank account (name, number, IFSC, bank). The shop's credit sheet shows exactly
  what is saved there; until something is saved it says to use Talk to us (Q35).
- **R12** — One top-up is at most ₹10,00,000 (Q36).
- **R13** — Everything works on a ~360px phone.

## Product acceptance
- **A1** — After shipping, every shop shows ₹2,500.00 with one "Starting credit" line.
- **A2** — The admin records ₹1,000 by UPI with reference `UTR123`; the shop's balance rises by
  ₹1,000 and the line shows the method and reference. Recording it without a reference is refused.
- **A3** — A picture costing the platform ₹2.04 at 0% margin takes ₹2.04; at a shop's 10% it takes
  ₹2.25 (₹2.244, rounded up to the paisa), and the line shows ₹2.04 cost and 10%.
- **A4** — A failed picture leaves the balance where it started, with both lines visible.
- **A5** — A shop with ₹1.00 left asking for a ₹2.04 picture is refused with its balance shown.
- **A6** — A settlement cannot be marked paid without a reference; once paid, its proof is shown.

## Scope
- **Outcome:** the owner and each shop can both see exactly what AI pictures cost and what is left.
- **In:** R1–R13.
- **Later:** paying online through the platform; invoices.

## Open questions
None.

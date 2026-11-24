# Spec — social-selling/whatsapp-campaigns

- **Summary:** A shop sends a WhatsApp message, with products if it likes, to a list of its opted-in customers, seeing who will get it and what it costs before it goes, and how it went after
- **Status:** Accepted
- **Domain:** campaigns
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q8, Q40, Q47, Q75), [whatsapp-sending](../whatsapp-sending/spec.md), [audience](../audience/spec.md), [whatsapp-catalogue](../whatsapp-catalogue/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Reach out.
> The composer and report; every message goes through whatsapp-sending.

## What this feature is
A Campaigns page: write a message from an approved template, add products from the catalogue,
pick a list, see who gets it and what it costs, send now or schedule, and read the report.

## Why
"New arrivals" and "Eid offer" messages to customers who asked for them are how Indian shops sell
on WhatsApp. Today they forward by hand to broadcast lists the coexistence app makes read-only; a
campaign does it properly, within consent and a budget (parent Q40).

## Requirements
- R1 — Campaigns is a tab of Customers (parent Q110). A member creates a campaign: an approved
  template with its blanks filled, optionally one product or up to 30 from the WhatsApp catalogue,
  sent to one named list (Q1).
- R2 — Before confirming, the shop sees who will get it, who is skipped and why (not opted in,
  stopped, over a cap), the price per message and the estimated total in rupees (Q3).
- R3 — It goes now, or at a minute the shop picks; a scheduled campaign recounts at send and never
  reaches more people than the shop confirmed (Q3, Q13).
- R4 — Products in a message show the catalogue's price, which is always the page's (parent Q47).
- R5 — A campaign can be edited or cancelled until it starts, then stopped while sending; those not
  yet sent are not charged. One due during an outage goes when the worker resumes, unless more than
  six hours late, when it waits for the shop (Q13).
- R6 — The report shows sent, delivered, read, failed and skipped, each with reasons, the actual
  cost, and buttons tapped where the template has them (Q14).
- R7 — Every campaign shows who created, scheduled and sent it; every member sees every campaign
  (parent Q8).

## Hazards the TRD must answer
- **A list of thousands** sent within Meta's throughput and the shop's messaging tier.
- **A template paused by Meta** between scheduling and sending.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A campaign "New arrivals" with three products to a list of 120 shows 104 to receive, 16
  skipped with reasons, and the estimated cost, before Send.
- A2 — Scheduled for Friday 7pm, it recounts then and sends to no more than 104.
- A3 — Stopped half-way, the unsent are not charged and the report says so.
- A4 — The report shows delivered and read counts and the actual cost.

## Scope
- **Outcome:** a shop messages its opted-in customers knowing who and what it costs.
- **In:** R1–R7, tested by A1–A4.
- **Later:** A/B tests, recurring campaigns, sales per campaign (parent Q108).

## Open questions
None.

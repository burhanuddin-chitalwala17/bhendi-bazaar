# Spec — social-selling/whatsapp-templates

- **Summary:** A connected shop has ready-to-send WhatsApp templates in English and Hindi from day one, can write its own, and always sees Meta's verdict and the cost of each
- **Status:** Draft
- **Domain:** campaigns, with channels as the WhatsApp plug
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [whatsapp-campaigns](../whatsapp-campaigns/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 12 of
> social-selling; whatsapp-campaigns and notification-hub send only through what this makes.

## What this feature is
A Templates page under the shop's WhatsApp. Starter templates arrive on connect, already sent to
Meta for approval. The shop can write its own, and every template shows, in plain words, whether
Meta approved it, why it did not, and what one message costs.

## Why
WhatsApp lets a business start a conversation only with a template Meta has approved (parent Q37).
Without templates a shop that connected WhatsApp can send nothing. Writing one that passes Meta's
review is unfamiliar to most sellers, so a set that is ready on day one, in the languages its buyers
read (parent Q65), is what makes campaigns and alerts possible at all.

## Requirements
- R1 — On connecting WhatsApp, the starter set is submitted to the shop's own WhatsApp account in
  English and Hindi, with nobody doing anything (Q1, Q2). The Hindi is read by a native reader
  before it is first submitted (Q3).
- R2 — A shop writes its own template: category, language, header, body with placeholders from a
  closed list, footer, buttons (Q5). Every marketing template carries a way to stop (parent Q9).
- R3 — A starter template is never edited in place; the shop copies it and edits the copy (Q4).
- R4 — Each template shows Meta's state in plain words: in review, approved, rejected with Meta's
  reason and what to change, paused with when it resumes, disabled (Q7).
- R5 — Each template shows Meta's category and its price per delivered message, in rupees, with the
  date that price was checked (Q6, Q10, Q11).
- R6 — A campaign scheduled on a template that is no longer approved does not send and is not
  charged; it says why and offers another approved template (Q8).
- R7 — A template can be archived; it disappears from choices, stays readable in past campaigns (Q9).
- R8 — Any member may write, copy or archive a template (parent Q30); who did is recorded.
- R9 — A shop without WhatsApp connected sees what templates are for and how to connect.

## Hazards the TRD must answer
- **A missed status webhook** leaves a template shown Approved after Meta paused it.
- **A double submission** on a retried connect job creating two copies at Meta.
- **Meta re-categorises a template** from utility to marketing, changing its price after the shop
  chose it.
- **A placeholder with no value** at send time (a buyer with no first name) failing the send.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — Connecting WhatsApp on the owner's test account leads, within a day, to twelve starter
  templates shown Approved (or with Meta's reason).
- A2 — A shop writes a marketing template in Hindi with an image header; it shows In review, then
  Meta's verdict, without a refresh by hand beyond opening the page.
- A3 — A rejected template shows Meta's reason and a Copy and fix action.
- A4 — Pausing a template at Meta (or a recorded paused webhook) holds a scheduled campaign using
  it, with no charge recorded.
- A5 — Every template shows its price per message and the date of that price.
- A6 — Every state in ux.md's matrices can be reached and reads as written.

## Scope
- **Outcome:** a connected shop has approved templates to send, and knows what each costs.
- **In:** R1–R9, tested by A1–A6.
- **Later:** sending (whatsapp-campaigns); alerts using templates (notification-hub); read and click
  rates (with campaign reports).

## Open questions
None. Q3 decided by the owner 2026-11-06.

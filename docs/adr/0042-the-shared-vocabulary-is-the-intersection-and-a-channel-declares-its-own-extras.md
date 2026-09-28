# ADR-0042: The shared vocabulary is the intersection, and a channel declares its own extras

- **Date:** 2026-09-29
- **Status:** Accepted

## Context

Selling one product in many places needs one description of it. Every platform wants roughly the
same dozen facts — a title, a brand, a colour, a material, a weight, a tax code — and then each
wants things nobody else does: Amazon a browse node and exactly five bullet points, Myntra a
brand code it issues, Flipkart its own procurement terms.

The tempting shape is one product record wide enough for all of them. It fails slowly: each new
channel adds columns that are null for every other channel, and within a year the "canonical"
model is a union of seven platforms' demands with no one able to say which fields matter. The
other tempting shape is a free-form JSON bag per channel, which costs nothing today and can
answer no question about itself.

A product today holds `tags`, `sizes`, `colors` as unbounded `String[]` with no closed set behind
any of them, so there is no vocabulary to preserve — this decision is about what replaces that.

## Decision

1. **The shared vocabulary is the intersection: what a shop knows about its own product.** A
   field earns a place because the person who made or bought the thing can answer it, not
   because a platform asks. "Amazon requires it" is never a reason for a canonical field.
2. **A channel's extra fields are declared by its adapter, as a schema.** Not a bag. The
   declaration names each field, its type, its limits and the words shown to a shop, and it is
   the same declaration that renders the form, validates the write and answers readiness.
3. **Extra values are stored per product and channel**, against that schema, and are meaningless
   outside it. A channel that is removed takes its fields' meaning with it.
4. **The form is generated from the declaration.** When a shop ticks Amazon, Amazon's fields
   appear because its adapter declared them — not because a hand-built Amazon form exists.
5. **This is the pattern `shotList` already proves.** `server/catalog/shot-list.ts` declares a
   slot schema, stores it as JSON on a category, validates on the way in, and the product form
   renders the named slots from it. The channel adapter is the same idea with a different
   subject, and following it means one pattern in the codebase rather than two.

## Alternatives considered

- **One wide product record covering every platform.** The conventional answer and the one most
  catalogue tools reach for. Rejected because the union model cannot be read: with seventy
  fields of which nine apply to any given product, no screen and no reviewer can tell what is
  required, and the model grows monotonically because nothing is ever safe to remove.
- **A free-form `platformData` JSON bag per channel.** Genuinely cheaper, and the first instinct.
  Rejected on what it forecloses rather than what it costs: readiness per channel cannot be
  computed against a bag, a missing required field is discovered as a rejection from the
  platform hours later rather than in front of the shop, a platform adding a requirement is
  learned from failures, and the per-channel form has to be hand-built once per platform — which
  is seven forms that drift from what the adapter actually sends.
- **Generate the canonical model from the platforms' own schemas.** Attractive, and the reason it
  loses is the same reason the mappings are data: the platforms disagree about categories and
  values, so the generated union would be larger and less stable than a hand-held intersection,
  and it would change under us without a decision being taken.
- **Let each adapter hold its extras in its own table.** Rejected as premature: seven tables
  that differ only in their columns, when one table keyed by channel and validated by a
  declaration says the same thing and lets a new channel arrive without a migration.

## Consequences

- ✅ Three things asked for in the same breath — per-platform forms, readiness per channel, and
  errors that reach the shop rather than the log — all fall out of one declaration.
- ✅ The canonical model stays small enough to read, and a new channel adds no column to it.
- ✅ A platform changing its requirements is a declaration bump, and every affected product turns
  not-ready naming the fact that is missing.
- ⚠️ More work than a bag, and the declaration is a second thing to keep true. An adapter whose
  schema drifts from what it sends will pass its own validation and be rejected downstream.
- ⚠️ Extra values are only as portable as the channel they belong to. A shop that leaves Amazon
  loses the bullet points it wrote, which is correct and will still feel like a loss.

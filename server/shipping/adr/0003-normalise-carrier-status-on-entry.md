# ADR-0003: Carrier status vocabularies are normalised at the boundary

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** Every carrier invents its own status vocabulary, at its own granularity — one may distinguish *picked up*, *in transit*, and *reached destination hub* where another reports only *shipped*. Those strings arrive over a webhook we do not control, and a carrier can add or rename one without notice.

  If they are stored or displayed as received, three things follow: the customer-facing status text changes meaning when a carrier is switched, every consumer has to know every carrier's vocabulary, and historical rows become uninterpretable once a carrier revises its terms.
- **Decision:**
  1. A carrier's status is mapped to our own closed set at the boundary, in `utils/statusNormalizer.ts`, before anything is persisted or returned.
  2. **A raw carrier status string never reaches the database, the client, or an email.**
  3. Our status set is a closed union declared once — not magic strings ([`/CLAUDE.md`](../../../CLAUDE.md), development principles).
  4. An unrecognised carrier status maps to a defined *unknown* value and is **logged**, rather than being passed through or silently dropped. It is a signal that a carrier changed something.
  5. The raw payload is retained on the shipping event for diagnosis, but is not the field anything reads for logic.
- **Alternatives considered:**
  - *Store the carrier's status and translate at display time* — rejected. It pushes carrier knowledge into every consumer, and translation would have to be applied consistently in the storefront, the admin console, and email templates. Normalising once at entry is one place instead of many.
  - *Store both, treating the carrier's as authoritative* — rejected as the worst of both: two fields that can disagree, with no rule for which wins.
  - *A superset vocabulary covering every carrier's granularity* — rejected. It grows with each carrier and pushes carrier-specific distinctions into a supposedly shared type, defeating [ADR-0001](0001-provider-behind-an-interface.md).
  - *Fail the webhook on an unrecognised status* — rejected. A carrier adding a status is routine and should not stop tracking updates. Rule 4's log-and-continue is the proportionate response — note this is deliberately *not* the same as the loud-failure rule for unmatched webhooks, which concerns a payload we cannot attribute to a shipment at all.
- **Consequences:**
  - ✅ Customer-facing status is stable across carriers and over time.
  - ✅ Consumers depend on one closed set; adding a carrier changes only its mapper.
  - ✅ Historical events stay interpretable after a carrier revises its terms.
  - ⚠️ A carrier's finer-grained distinctions are lost when they do not map onto our set. Accepted: the set exists to be meaningful to a customer, not to mirror a carrier's internal pipeline.
  - ⚠️ Each new carrier needs a mapping decision per status, which is real work and easy to do carelessly. Rule 4's logging is what surfaces a mapping that was missed.

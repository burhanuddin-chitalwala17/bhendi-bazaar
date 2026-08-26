# Spec — transactional email

- **Status:** 📝 Draft — TRD pending a spike
- **Domain:** notifications *(callers: checkout, payouts, catalog, identity, shipping)*
- **Phase:** 8 — Notifications
- **Verified:** 2026-08-26
- **References:** trd.md *(not yet written)*, [org-payouts](../org-payouts/), [multi-vendor-marketplace](../multi-vendor-marketplace/), [shipping-fulfilment](../shipping-fulfilment/), [ADR-0015](../../adr/0015-mobile-first-design.md), [INTEGRATIONS.md](../../INTEGRATIONS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
One notification capability the whole store sends through. A domain declares *what happened*; the capability decides who hears about it, writes each of them their own message, sends it, and keeps a record that it did.

## Why
Three audiences now have a stake in the same events. A sale concerns the buyer who paid, the organisation whose goods left its shelf, and the platform that earns from it — one event, three readers, three different messages. A settlement concerns the organisation being paid. None of that is expressible as a function that mails one person about one order.

The store's email today is three unrelated senders, each hand-wired to a single recipient it computes for itself. Adding a fourth means writing recipient resolution, rendering, failure handling and record-keeping a fourth time, and the fifth is where they start disagreeing about what a name looks like or what a rupee looks like. The cost is not in any one email — it is that each new one carries the same four decisions again, made slightly differently.

Which audiences exist and which events matter will keep changing. What must stop changing is the machinery: a new notification should be a declaration of reader, occasion and content, and nothing else. This spec is deliberately about that machinery, not about any particular email.

## Requirements

### The capability
- **R1** — A domain announces an occasion and stops. It names no recipient, formats no money, and knows nothing about how mail is sent.
- **R2** — One occasion reaches every audience it concerns, as a separate message written for that reader. Adding a second reader to an existing occasion is not a change to the domain that announces it.
- **R3** — A send never affects the outcome of what triggered it. A confirmed payment stays confirmed and a settlement stays paid whether or not the mail leaves — and whether the failure was a bad address, a provider outage, or missing configuration.
- **R4** — A reader is told once per occasion. An occasion announced twice — a replayed gateway signal, a retried job, a re-run sweep — does not mail them twice.
- **R5** — Every message inherits its layout, brand, and the formatting of money, dates, quantities and addresses. A new notification cannot render a rupee differently from an existing one, and text a person typed cannot alter the shape of the message that carries it.
- **R6** — Every message ends in the app: it links the reader to the exact page for the thing it describes, on the portal that reader belongs to.
- **R7** — Any message is producible on demand for a past occasion without waiting for it to recur, so a message can be reviewed, re-sent, or checked against a real record.

### Who hears what
- **R8** — Recipients are resolved from the store's current records at the moment of sending, never from a copy taken when the occasion happened. An owner who left an organisation last week is not written to today.
- **R9** — A buyer is reachable for every order they place, including as a guest. Where a buyer has an account, an order carrying no address email still reaches them.
- **R10** — An organisation is reachable through its members, by role. Its owners hear about money; who else hears what is a setting of the organisation, not of the code.
- **R11** — The platform is reachable through its owners, and hears about the store as a whole rather than about one order at a time.
- **R12** — An occasion with no reachable reader is a recorded outcome, not silence. Nobody-to-write-to is a legitimate state; not knowing it happened is not.

### The occasions this must carry
- **R13** — A paid order tells the buyer what they bought and what they paid, itemised, with the order's identifier and a link to it.
- **R14** — The same paid order tells each organisation which of its goods sold, in what quantity, and where it is going.
- **R15** — The same paid order tells the platform that a sale happened, without requiring it to open the admin console to find out.
- **R16** — A settled payout tells the organisation what was paid, what it covers, and when.
- **R17** — Occasions arrive continuously as the product grows — a shipment moving, an organisation approved, stock running out, a payout adjusted. Each must be addable as a declaration alone.

### Operability
- **R18** — Every attempt is recorded with its outcome, and the record answers "was this reader told, and when" without reading application logs.
- **R19** — A message that failed for a reason that may pass is retried; one that failed for a reason that will not is not retried, and is visible as undelivered.
- **R20** — Outside production, no message reaches a real customer or a real organisation. A developer or a preview deployment can exercise the whole path without that being a risk.
- **R21** — A deployment that cannot send says so at deploy time. Configuration that is absent or unusable is never discovered by a buyer not receiving a receipt.
- **R22** — Sending is legible to the platform: what has been sent, to whom, what failed, and what is stuck, without database access.

### The reader's experience
- **R23** — Every message is legible on a phone first: one column, readable without zoom, tappable links ([ADR-0015](../../adr/0015-mobile-first-design.md)).
- **R24** — Every message identifies the store, says why the reader is receiving it, and reads as correspondence from a business rather than a system notification.
- **R25** — Every message is readable where images and styling do not load, and where only plain text is shown.

## Product acceptance
- **A1** — A paid order produces the buyer's receipt, one message per selling organisation, and one to the platform — all from a single announcement in the domain that confirmed the payment.
- **A2** — Paying, then replaying the same confirmation, leaves each reader with exactly one message.
- **A3** — Turning off the mail provider entirely leaves orders payable, settlements payable, and every skipped message visible as such.
- **A4** — A new occasion — a settled payout — is added by declaring reader and content, with no change to how any other message is sent, recorded, or retried.
- **A5** — Adding a second reader to the paid-order occasion changes nothing in `checkout`.
- **A6** — Every message opens legibly on a ~360px phone, in a client with images blocked, and in plain text.
- **A7** — For any past order or settlement, the platform can see whether each reader was written to, and open what they were sent.
- **A8** — Running the full path locally mails no customer.

## Out of scope (this feature)
- **Marketing and campaign email** — anything a reader could reasonably want to stop receiving. Consent and unsubscribe are that feature's problem, and mixing them into transactional mail is how a receipt acquires an unsubscribe link.
- **Other channels** — SMS, WhatsApp, push, and an in-app notification feed. The occasion vocabulary should not prevent them; nothing here delivers them.
- **A reader-facing preference centre.** R10 covers an organisation choosing which of its members hear what; per-person subscription management does not follow from it.
- **The shipping occasions themselves** — dispatched, in transit, delivered. They are declarations under R17, and their content belongs to [shipping-fulfilment](../shipping-fulfilment/).
- **Reconciling against the provider** — treating bounces, complaints and opens as store data. R18 records what we attempted; what the recipient's mail server did with it is a later question.

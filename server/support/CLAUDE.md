# support — domain rules

Inbound correspondence. One aggregate, `ContactMessage`: what a buyer or visitor writes
through **Contact us**, and the admin portal's work through it. Spec and TRD:
[docs/specs/contact-us/](../../docs/specs/contact-us/).

This is not `notifications`. That domain sends transactional email *out* and knows
nothing about what arrives; an inbox folded into it would give it a second reason to
change ([ADR-0012](../../docs/adr/0012-modules-are-vertical-slices-by-domain.md)).

## The sender's identity is re-read, never taken from the body

`submit` accepts a name and email because the same form serves signed-out visitors, and
**discards both** when it is given a `userId`, reading the `User` row instead. A
signed-in person's name is a server-owned field, so accepting it from a payload is
Invariant 4's mass-assignment shape wearing a different hat — the store has to know who
wrote, not who claimed to.

The one exception is an account with a `null` name, where what they typed is the better
answer. A session pointing at a deleted account is handled as a guest: the foreign key
would refuse the row otherwise.

## The flood guard counts rows, and says so

`src/lib/rate-limit/` allows every request until the cache is wired
([specs/rate-limiting](../../docs/specs/rate-limiting/)), so this domain refuses a fourth
message inside ten minutes by counting the sender's recent rows — keyed on the account
when there is one, else the submitted email. **A guest who changes the email gets a
fresh allowance.** That hole is known and closes when `withRateLimit` on
`POST /api/contact` becomes real; do not describe this as rate limiting.

## No email leaves this domain

A message arriving notifies nobody — the portal is the inbox ([spec](../../docs/specs/contact-us/spec.md)
R9). Adding a notification means calling `notifications` from the service, never
importing a template here.

## WhatsApp is not server-side

The second Contact us option is a `wa.me` link built in `src/lib/support-contact.ts` from
the number in `src/lib/config.ts`. Nothing about it reaches this domain, and there is no
row for a conversation that happens on WhatsApp.

## Status changes are audited; submissions are not

`setStatus` goes through `recordAdminAction` after the write
([ADR-0021](../../docs/adr/0021-audit-trail-never-fails-the-action.md)). A buyer sending
a message is not an admin action and leaves no trail entry.

Verified: 2026-09-16

---
name: bb-review
description: Pre-merge review for bhendi-bazaar. Checks a diff against the seven Project Invariants in CLAUDE.md (pricing authority, payment state, integer paise, boundary validation, one repository per aggregate, conditional stock, seed safety) plus the documentation conventions. Invoke before any PR is considered done. Different from the built-in /review — this one knows the project's rules. Examples — "/bb-review", "/bb-review before I merge", "review my diff against the invariants".
---

# /bb-review — pre-merge review

Reviews the current diff against **this project's** rules, not general good practice. The built-in `/review` covers generic code quality; this covers the things that have actually gone wrong here.

## Scope

```bash
git diff main...HEAD            # default: the branch
git diff --stat main...HEAD     # orient first
```
If the user names a range or path, use that instead. If the branch *is* `main`, review uncommitted changes (`git diff HEAD`).

Read the whole changed file, not just the hunk — several invariants below are about what a file *doesn't* do, which a hunk cannot show.

---

## Part 1 — The seven Invariants

These are **hard blocks** ([CLAUDE.md](../../../CLAUDE.md)). A violation means the PR is not ready, regardless of anything else. Each has an ADR; cite it so the finding is arguable rather than an assertion.

### I1 · Server holds pricing authority — [ADR-0002](../../../docs/adr/0002-server-holds-pricing-authority.md)
Does any new or changed code persist, or charge, a monetary value that arrived in a request body?
- A price, total, subtotal, discount, or gateway amount read from `request.json()` and then written or sent onward.
- A schema newly *accepting* a price field.
- A total "validated" by comparison against other client-supplied numbers — self-consistency is not verification.
```bash
git diff main...HEAD -- src/app/api src/lib/validation server | grep -nE '\b(price|salePrice|amount|total|subtotal|grandTotal|discount)\b'
```
Ask of each hit: *where did this number come from?* If the answer is the request, it is a violation.

### I2 · Payment state only on a verified gateway signal — [ADR-0005](../../../docs/adr/0005-payment-state-server-only.md)
- Any write of `paymentStatus` outside the single confirmation path.
- `paymentStatus` appearing in a request schema.
- A handler that verifies a signature and returns a boolean instead of performing the transition.
- **A webhook or verification path that returns 2xx on an unrecognised or unmatched payload.** This is how a dead payment path stayed invisible; treat a silent success as a violation in its own right.
- A signature compared with `===` rather than `crypto.timingSafeEqual`.

### I3 · Money is integer paise — [ADR-0004](../../../docs/adr/0004-money-as-integer-paise.md)
- A new `Float` monetary column, or float arithmetic on money.
- **Any epsilon comparison on an amount** (`Math.abs(a - b) < ...`). This is a violation, not a tolerance.
- A `* 100` or `/ 100` outside `src/lib/format.ts` — the conversion belongs in one place.
- Note: until [money-as-paise](../../../docs/specs/money-as-paise/) lands the columns are still `Float`. Flag *new* violations; do not demand the migration in an unrelated PR.

### I4 · Every body parsed, never cast — [CLAUDE.md](../../../CLAUDE.md) Invariant 4
```bash
git diff main...HEAD | grep -nE 'request\.json\(\)\s*\)?\s*as |as unknown as'
```
- `as SomeType` on `await request.json()` — a compile-time fiction with no runtime effect.
- `data: input` into a Prisma call where `input` traces back to a request body (mass assignment).
- A create that whitelists fields while its matching update does not.
- Server-owned fields accepted as input: `rating`, `reviewsCount`, `createdAt`, `updatedAt`, `paymentStatus`, computed totals.
- **`any` in a route handler, auth, or payment code** — a defect at a trust boundary, not a style issue.

### I5 · One aggregate, one repository — [ADR-0003](../../../docs/adr/0003-one-repository-per-aggregate.md)
- A `prisma.<model>` call outside that model's repository — including in a route handler.
- A **new** repository module for a table that already has one.
- A duplicated class or singleton export name.
- A closed set (enum / `as const` union) declared a second time.
```bash
git diff main...HEAD -- src/app/api | grep -nE 'prisma\.[a-z]'
```

### I6 · Stock moves conditionally, in-transaction — [ADR-0007](../../../docs/adr/0007-conditional-stock-decrement.md)
- A stock read followed by a stock write. Read-then-write is not a check, even inside `$transaction` — the default isolation permits concurrent callers to pass the same check.
- Stock changed outside the transaction that creates the order.
- More generally: **any invariant guarded by a read rather than by a conditional write.**

### I7 · Seeds refuse non-local databases — [CLAUDE.md](../../../CLAUDE.md) Invariant 7
- Any new destructive operation under `prisma/` without a host check.
- A guard written as a denylist of production hosts rather than an allowlist of local ones — a denylist fails open on an unrecognised host.
- A credential literal in a seed.

---

## Part 1b — Error handling and forms ([ADR-0013](../../../docs/adr/0013-one-error-envelope-and-useserverform.md))

Not an Invariant, but the same kind of failure: silent, and invisible to `tsc`.

**Route handlers**
- A `catch` block building its own body — `NextResponse.json({ error: ... })` — instead of returning `toErrorResponse(error, "...")`. Hand-rolled error bodies are how the envelope drifts.
- A handler that casts its request body instead of parsing it with a schema (also Invariant 4).
- `error instanceof Error ? error.message : "..."` returned to a client — that pattern leaks internal messages; `DomainError` is how a message opts in to being shown.

**Domain code**
- A `throw new Error(...)` whose message is clearly meant for a user. Use `DomainError` / `NotFoundError` / `ConflictError` / `ForbiddenError`. The test: *if the fix is in config or code it stays internal; if the fix is in what the user did or state they control, it is a domain error.*
- A `catch` that rethrows a fixed string and drops the original — pass `{ cause: error }`.

**Client wrappers**
- Reaching into a response body by hand (`error.error`, `error.message`, `error.details`) instead of `throw await readApiError(response)`. **A key mismatch here typechecks and fails silently** — it has already happened three times in this codebase.

**Forms**
- `useForm(` instead of `useServerForm(` in a form that submits to the server.
- Error handling *inside* a form — a `try/catch` around submit, a `toast.error` for a server failure, a local `error` state. If the form needs it, the hook is missing something and should grow instead.
- A form validating with hand-written `register` rules where a schema exists, or with a schema that is not the one the route parses.

**A field and its error are two separate things** — bind one without the other and the form refuses to submit while saying nothing. `tests/unit/form-error-display.test.ts` fails the build on it, so the review job is only to judge new `EXEMPT` entries: a field is exempt when it has no reachable failure, not when showing the error is inconvenient.

**Rendering mode** ([CLAUDE.md](../../../CLAUDE.md) — render on the server by default)
- A new `"use client"` on a component that only reads and displays. Ask what interactivity earned it; if the answer is "it needed data", it wanted props.
- A client-side `fetch("/api/…")` for a read a server component could have done. The route handler and the client wrapper are both then dead weight, and the user gets a spinner over data the server already had.
- A new route handler with no browser caller — a read reachable from a server component does not need one.
- `"use client"` at the top of a page whose interactive part is one button. Push the boundary down to the leaf.

**Design tokens** ([CLAUDE.md](../../../CLAUDE.md) — colour goes through tokens)
- A raw palette class (`bg-emerald-50`, `text-gray-500`, `border-red-200`) in a className. Colour reaches the UI only through the semantic tokens in `src/app/globals.css` — `primary`, `muted`, `destructive`, `success`/`warning`/`info`, `scrim`, `hero`. `tests/unit/design-tokens.test.ts` fails the build on these; the review job is the cases the test cannot judge:
  - a **new allowlist entry** — legitimate only for literals that are *data* (values stored in the database), never for styling convenience;
  - a `dark:` override next to a token — usually a sign the wrong token was chosen, since tokens flip themes by themselves;
  - an overlay or fixed brand surface mapped to a theme token (`bg-foreground/50` as a dim layer inverts in dark mode — that is `scrim`);
  - a new one-off token added for a single component — the vocabulary is small on purpose; ask whether an existing token names the same job.
- Arbitrary bracket values (`w-[123px]`, `text-[#0a0a0a]`) without a stated reason — Tailwind's scale is the size/spacing token system.
- A new UI element hand-rolled where a shared component exists (`DataTable`, `StatusBadge`, `Card`, `FormInput`, `PortalSidebar`, `PortalHeader`) — the org orders page shipped with a hand-rolled table while `DataTable` sat unused, which is how two of everything happens.

**Does the schema accept what the form actually sends?** The form sends its default values, so read the two together:
- An optional field whose schema rejects its own default. A UI hint reading "leave empty" over a required rule is the tell.
- A number input registered `valueAsNumber` whose schema field is not wrapped in `optionalNumber` — a blank input is NaN, and `z.number().optional()` rejects NaN.
- A field the form marks `required` that the schema leaves optional, or the reverse. The stricter side is the one users meet; make the schema say it, since the schema is also what the route enforces.

```bash
git diff main...HEAD | grep -nE 'useForm\(|NextResponse\.json\(\s*\{\s*error|error\.(message|error|details)|throw new Error\(|valueAsNumber'
```

**Migrate on contact.** ADR-0013 decision 7: if the diff touches a form or handler that still uses the old pattern, converting it is part of the change. Flag a modified file left on the old pattern — that is exactly how the product form ended up as the only form with no error display while its sibling had one.

---

## Part 2 — Process

- **CHANGELOG entry present?** Required for every PR, including trivial ones ([CLAUDE.md](../../../CLAUDE.md)). Newest at top, append-only.
- **`[CONTRACT]` flag** if a DTO in [CONTRACTS.md](../../../docs/CONTRACTS.md) changed — and `CONTRACTS.md` updated in the same PR. Check especially for a field whose *unit or meaning* changed without its type changing; nothing fails to compile, so nothing else will catch it.
- **`[MIGRATION]` flag** if `prisma/migrations/` gained a file.
- **Tests for changed logic.** No exception. If the change touches an Invariant, the test is the deliverable — see [TESTING.md](../../../docs/TESTING.md) for the 100% targets.
- **A TRD** if the PR changes architecture or data flow, adds a package, starts a feature, or changes a contract.
- **`ARCHITECTURE.md` updated** only if structure changed — and *after* the change, never as a plan.
- **`DEPENDENCIES.md` row** if a package was added.

## Part 3 — Documentation conventions

- **No pasted implementation code in docs** ([ADR-0009](../../../docs/adr/0009-docs-reference-code-never-copy-it.md)). A new fenced block in a `.md` file outside the stated exceptions — shell commands, env-var names, wire-format JSON, diagrams — is a violation. Reference `path/file.ts` plus a symbol name instead.
- **`Verified:` date updated** on any doc whose claims were re-checked. A doc edited without touching its `Verified:` date is suspect.
- **Links resolve.** A doc must not link to a file that does not exist.
```bash
grep -ohE '\]\([^)]+\.md[^)]*\)' <changed docs> | sed -E 's/^\]\(//; s/\)$//'
```
- **No findings recorded as documentation.** A bug list, audit result, or "known broken" section does not belong in a doc — it goes stale the moment it is fixed. The requirement belongs in a spec; the defect belongs in a PR.
- **Specs within ≤100 readable lines** ([ADR-0010](../../../docs/adr/0010-spec-convention.md)): prose only, excluding front-matter, headings, tables, fenced blocks, link-only lines, and blanks.
- **Comments are one or two lines, and explain *why*.** Flag a comment block that restates the code, narrates the next line, or runs to a paragraph — that reasoning belongs in an ADR or spec, linked from a short line ([`/CLAUDE.md`](../../../CLAUDE.md), Development Principles).

## Part 4 — Report

Order by severity: **Invariant violations first** (they block), then process gaps, then documentation.

For each finding: the file and line, which rule and ADR, what specifically is wrong, and the fix in one line.

Verify before reporting. Read the surrounding code — several of these look like violations in a hunk and are fine in context, and a false positive on a hard block costs more than a missed nitpick. If a rule genuinely does not fit the situation, say so and say why: the rule may need an ADR amendment, and that is a legitimate outcome of a review.

If nothing is wrong, say so plainly. Do not invent findings to look thorough.

## Notes

- **Not a security audit.** This checks the rules the project has written down. A finding that falls outside all seven Invariants and is genuinely a problem should still be reported — and if it represents a rule worth having, propose an ADR via `/bb-sdlc adr-new`.
- **Don't fix while reviewing** unless asked. Report, then let the author decide.

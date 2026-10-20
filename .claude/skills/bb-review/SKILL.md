---
name: bb-review
description: Pre-merge review for bhendi-bazaar. Checks a diff against the seven Project Invariants in CLAUDE.md (pricing authority, payment state, integer paise, boundary validation, one repository per aggregate, conditional stock, seed safety) plus design tokens and the primitive palette (ADR-0022, ADR-0049), front-end layering — API clients, hooks, DTO props (ADR-0048) — form factors (ADR-0050), image delivery (ADR-0026), mobile-first UI (ADR-0015), portal guards, allowlist edits, and the documentation conventions. Invoke before any PR is considered done. Different from the built-in /review — this one knows the project's rules. Examples — "/bb-review", "/bb-review before I merge", "review my diff against the invariants".
---

# /bb-review — pre-merge review

Reviews the current diff against **this project's** rules, not general good practice. The built-in `/review` covers generic code quality; this covers the things that have actually gone wrong here.

## Scope

Work is committed on `develop` one PR-sized unit at a time, so `main...HEAD` is weeks of commits, not a PR. Pick the range in this order:
1. A range, commit or path the user names.
2. On a feature branch: `git diff develop...HEAD`.
3. Otherwise, uncommitted work plus the last commit: `git diff HEAD~1`. Ask if the unit spans more commits.

Below, `$RANGE` stands for whichever you chose; `git diff --stat $RANGE` first, to orient.

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
git diff $RANGE -- src/app/api src/lib/validation server | grep -nE '\b(price|salePrice|amount|total|subtotal|grandTotal|discount)\b'
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

### I4 · Every body parsed, never cast — [CLAUDE.md](../../../CLAUDE.md) Invariant 4
```bash
git diff $RANGE | grep -nE 'request\.json\(\)\s*\)?\s*as |as unknown as'
```
- `as SomeType` on `await request.json()` — a compile-time fiction with no runtime effect.
- `data: input` into a Prisma call where `input` traces back to a request body (mass assignment).
- A create that whitelists fields while its matching update does not.
- Server-owned fields accepted as input: `rating`, `reviewsCount`, `createdAt`, `updatedAt`, `paymentStatus`, computed totals, `slug`.
- **`any` in a route handler, auth, or payment code** — a defect at a trust boundary, not a style issue.

### I5 · One aggregate, one repository — [ADR-0003](../../../docs/adr/0003-one-repository-per-aggregate.md)
- A `prisma.<model>` call outside that model's repository — including in a route handler.
- A **new** repository module for a table that already has one.
- A duplicated class or singleton export name.
- A closed set (enum / `as const` union) declared a second time.
```bash
git diff $RANGE -- src/app/api | grep -nE 'prisma\.[a-z]'
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

**Design tokens — every axis, not just colour** ([ADR-0022](../../../docs/adr/0022-design-decisions-go-through-tokens.md))

Every design decision reaches the UI through a token in `src/app/globals.css`. A literal at the call site pins one value in one place, which is what made a rebrand a one-file edit here while a redesign was a hundred-file hunt. `tests/unit/design-tokens.test.ts` fails the build on the mechanical cases across all six axes:

| Axis | Use | Never |
|---|---|---|
| Colour | `primary`, `muted`, `destructive`, `success`/`warning`/`info`, `scrim`, `hero` | `bg-emerald-50`, `text-gray-500`, `text-[#0a0a0a]` |
| Type size | `text-4xs`/`3xs`/`2xs` below Tailwind's `text-xs`, then the normal scale | `text-[0.7rem]`, `text-[11px]` |
| Tracking | `tracking-label`/`-eyebrow`/`-eyebrow-wide`/`-display` | `tracking-[0.18em]` |
| Elevation | `shadow-raised`/`-lifted`/`-overlay`/`-inset-field` | `shadow-sm`, `shadow-lg` |
| Shape | `rounded-card` (surfaces), `rounded-field` (controls) | picking a raw step per component |
| Page width | `<PageShell width=…>`, `max-w-page` | `mx-auto max-w-3xl` on a page |

The test catches those. **The review job is the cases it cannot judge:**

- A **new allowlist entry** — legitimate only for literals that are *data* (`category-accent.ts`) or a third party's property (`social-brand.ts`), never for styling convenience. Each entry names the one rule it is excused from; an entry that widens is a finding.
- A **raw colour smuggled inside an arbitrary value** — `bg-[radial-gradient(…,rgba(250,250,249,0.12),…)]`, `shadow-[0_2px_#000]`, `border-[oklch(…)]`. The regexes scan named palette classes and bare hex, so these pass the suite and are still literals. **This has already shipped once**, in the home hero's two decorative overlays.
- A **`dark:` override next to a token** — usually the wrong token, since tokens flip themes by themselves.
- An **overlay mapped to a theme token** — `bg-foreground/50` as a dim layer inverts in dark mode; that is `scrim`.
- A **new one-off token for a single component** — the vocabulary is small on purpose; ask whether an existing token names the same job. Elevation especially: the roles answer *what is this*, so a fifth role needs a fifth kind of thing, not a fifth shadow size.
- A **type step used against its meaning** — `text-4xs` exists for the 105px product tile ([ADR-0016](../../../docs/adr/0016-mobile-app-shell.md)), not as a way to fit copy that is too long. Nine-pixel text on a desktop surface is a finding.
- **Other arbitrary bracket values** (`w-[123px]`, `max-w-[10rem]`, `h-[42px]`) without a stated reason — Tailwind's scale is the size/spacing token system, and these are outside every regex above.

**A `font-*` class must resolve to a real family.** `--font-heading` was set by `next/font` but never registered as a theme token, so `font-heading` sat in twenty files — every page title among them — generating **no CSS at all** while every heading silently rendered in the body face. The suite now fails any `font-*` class with no matching `--font-*` token. In review, treat a new font utility as a claim to verify, not a class to read past: a class that does nothing looks exactly like a class that works.

**Reuse before invention.** A new UI element hand-rolled where a shared component exists (`PageShell`, `PageHeader`, `HeroBanner`, `DataTable`, `StatusBadge`, `Card`, `FormInput`, `PortalSidebar`, `PortalHeader`) — the org orders page shipped with a hand-rolled table while `DataTable` sat unused, and eight admin pages each spelled out the same `<h1>` before `PageHeader` existed. That is how two of everything happens.

```bash
git diff $RANGE -- 'src/**/*.tsx' | grep -nE 'text-\[[0-9.]+(rem|px|em)|tracking-\[|shadow-(xs|sm|md|lg|xl)\b|rgba?\(|oklch\(|mx-auto max-w-|font-[a-z]+'
```
The grep is a prompt, not the check — the suite already blocks the mechanical cases, so a hit here is usually either a blind spot above or a false positive.

**Image delivery** ([ADR-0026](../../../docs/adr/0026-images-are-delivered-through-the-optimizer.md) — stored small, served through the optimizer)

Vercel Blob's free transfer allowance was exhausted pre-launch by three changes that all looked right on screen; images now live in R2 ([ADR-0028](../../../docs/adr/0028-images-live-in-cloudflare-r2.md)) and the same rules hold. `tests/unit/image-delivery.test.ts` fails the build on a raw `<img>`, on `unoptimized`, and on `fill` without `sizes`. **The review job is what it cannot judge:**

- A **new allowlist entry**. Legitimate only for a local `blob:`/`data:` preview (bytes already in the page, and not something `next/image` accepts) or a renderer that cannot take `next/image` — Satori, in `opengraph-image.tsx`. "It was easier" is a finding, and so is an entry whose stated reason does not match what the file does.
- A **`sizes` that overstates the slot.** The test only checks that `sizes` exists. `sizes="100vw"` on a 64px avatar passes it and downloads the viewport width — the same overrun, now invisible. Read the value against the class list: a `size-16` box is `64px`, not `100vw`. The product tile's value is `PRODUCT_TILE_SIZES`; a second spelling of the same grid is a finding.
- A **new upload path that skips normalisation.** A server upload reaching `putObject` (`server/catalog/object-store.ts`) without `normalizeImage`. Browser-direct uploads (`uploadDirect`) must `downscaleImage` first, and `image-delivery.test.ts` fails a caller that doesn't, so judge only new allowlist entries.
- **A second spelling of the size budget.** `MAX_IMAGE_EDGE` and `IMAGE_QUALITY` are declared once in `server/catalog/media.ts` because two paths enforce them; a local `1600` is the drift starting.
- An **image fetched server-side per render** — an OG image or a metadata route pulling an R2 URL on every request is egress the optimizer never sees.

```bash
git diff $RANGE -- 'src/**/*.tsx' | grep -nE '<img|unoptimized|sizes="100vw"|no-img-element'
```
The grep is a prompt, not the check — the suite blocks the mechanical cases, so a hit is usually a new allowlist entry to judge or an overstated `sizes`.

**Mobile-first** ([ADR-0015](../../../docs/adr/0015-mobile-first-design.md) — base styles target a ~360px phone; breakpoints add, never restore)
- A **multi-column base**: `grid-cols-2/3/4` or a side-by-side flex row with no breakpoint prefix and no single-column base. The base layout is one column; `sm:`/`md:` add columns.
- A **desktop-first breakpoint**: base styles sized for a wide screen with small screens patched afterwards — the tell is a bare `hidden` paired with `md:flex`/`md:block` on something a buyer needs. Hiding a *primary action* (search, sign-in, nav, submit) below a breakpoint requires an equivalent mobile affordance **in the same diff**; hiding decoration is fine.
- A **hover-only affordance**: `opacity-0 group-hover:opacity-100` (or `hover:` revealing a control) with no visible-by-default state below `md`. Touch has no hover; the control simply doesn't exist on a phone.
- An **undersized touch target**: an interactive element below `size-9` (36px) — `h-7 w-7` icon buttons, bare-glyph `<button>`s with only `px-*`. Primary controls (submit, stepper, close) want ≥40px. A destructive control within one `gap-2` of a frequent-use control is the mis-tap setup.
- An **unscrollable overlay**: anything `fixed` + centred without `max-h-overlay` (the cap token in `globals.css`) and `overflow-y-auto` — the content clips and the bottom button becomes unreachable. A raw `max-h-[NNdvh]`/`[NNvh]` is the token's job; `DialogContent` already carries both, so a hand-rolled modal must too (or better, become a `Dialog`).
- An **input override that reintroduces iOS zoom**: `text-xs`/`text-sm` at base on an `Input` — the primitive's `text-base md:text-sm` is a deliberate guard. Also: a numeric field (PIN, OTP, quantity) without `inputMode`, an address/identity field without its `autoComplete` token.
- A **fixed width that can't fit 360px**: `w-[NNNpx]`/`min-w-*` ≥ ~16rem without an `sm:` gate, or `flex-1`/`justify-between` rows of no-wrap content missing `min-w-0`/`flex-wrap` — the classic horizontal-overflow pair.
- **DOM order vs mobile reading order**: stacked grids render in source order. If a buyer must see something before acting on it (the bill before Place Order), it must precede the action in the DOM; grid placement handles desktop.
```bash
git diff $RANGE -- 'src/**/*.tsx' | grep -nE 'grid-cols-[2-9]' | grep -vE '(sm|md|lg):grid-cols'
git diff $RANGE -- 'src/**/*.tsx' | grep -nE 'hidden (sm|md|lg):(flex|block|inline)|opacity-0 group-hover|h-[4-7] w-[4-7]"|size-[4-8]"|text-xs.*<Input|min-w-(64|72|80|96)\b' 
```
The grep is a prompt, not the check — most of these are judged by reading the component at 360px in your head. Dense admin tables satisfy the single-column rule by scrolling inside `overflow-x-auto` instead of reflowing.

**Does the schema accept what the form actually sends?** The form sends its default values, so read the two together:
- An optional field whose schema rejects its own default. A UI hint reading "leave empty" over a required rule is the tell.
- A number input registered `valueAsNumber` whose schema field is not wrapped in `optionalNumber` — a blank input is NaN, and `z.number().optional()` rejects NaN.
- A field the form marks `required` that the schema leaves optional, or the reverse. The stricter side is the one users meet; make the schema say it, since the schema is also what the route enforces.

```bash
git diff $RANGE | grep -nE 'useForm\(|NextResponse\.json\(\s*\{\s*error|error\.(message|error|details)|throw new Error\(|valueAsNumber'
```

**Migrate on contact.** ADR-0013 decision 7: if the diff touches a form or handler that still uses the old pattern, converting it is part of the change. Flag a modified file left on the old pattern — that is exactly how the product form ended up as the only form with no error display while its sibling had one.

**Front-end layering** ([ADR-0048](../../../docs/adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md), [ADR-0049](../../../docs/adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md), [ADR-0050](../../../docs/adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md); rules in [src/components/CLAUDE.md](../../../src/components/CLAUDE.md))

`api-clients.test.ts`, `module-boundaries.test.ts`, `design-tokens.test.ts` and `form-factors.test.ts` block the mechanical cases: `fetch` outside a client, `@prisma/client` in a component, raw colour outside the palette, an invented breakpoint. **The review job is what they cannot judge:**
- A client that **swallows an error** (returns a fallback, logs and continues) where the caller needed to know. Toasting is the caller's job, and so is deciding a failure is fine.
- A **hook doing two jobs**: fetching *and* holding form state, or returning presentation. Split it.
- A **DTO that is a row in disguise**: a `*.types` interface copying every column so a component can be handed the whole record.
- A **new palette primitive**: a new colour the system now owns. Ask whether an existing one was meant, since the `-soft` twins exist because nobody asked.
- A **`sizes` string that disagrees with its grid**: check it against the layout classes around it. The gallery shipped half-resolution images to tablets this way.
- **A layout branch in a script** (`useIsTabletUp`) where CSS breakpoints would do. Scripts branch only for surface pairs (ADR-0040) and rendition choice.

**Listing and channels** ([ADR-0051](../../../docs/adr/0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md), [ADR-0052](../../../docs/adr/0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md), [ADR-0053](../../../docs/adr/0053-readiness-advises-and-never-gates.md), [ADR-0054](../../../docs/adr/0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md); rules in `server/listing/` when it has a CLAUDE.md)

- A fact is stored with `{ value, origin }`, parsed through `storedFactsSchema`, filled on save never on read.
- Readiness **advises and never gates**: no `disabled` or refusal keyed on readiness; any such is a finding.
- A new fact passes the answerability test ([ADR-0047](../../../docs/adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)) and no per-platform section appears on the product form.
- Channel extras are a declared schema, never a bag ([ADR-0042](../../../docs/adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md) D3–D5).
- A seed or test never writes or deletes reference rows (product types, listing values, channel maps) as fixtures.
- A job is enqueued in the business transaction, the handler is idempotent on job id, and the interval is declared in `jobs-config` ([ADR-0038](../../../docs/adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)).

**Portal guards** — `/api/admin/**` calls `requirePlatformAdmin`, `/api/org/**` goes through `withOrg`, and a portal layout owns its guard. `portal-boundary.test.ts` and `portal-guards.test.ts` block the mechanical cases; judge any new exception.

**An allowlist edit is a finding to judge, never a formality.** Every gate here keeps an exception list. An entry added, or a reason that no longer matches its file, needs an argument in the diff. That covers `PUBLIC_SURFACE`, `ALLOWED_VIOLATIONS`, `RECORDED`, `MAY_USE_SHEET`, `SHAPE_LEGACY`, `EXTERNALLY_CALLED`, `DATA_DEPENDENT`, `NEVER_ASKS`, `REQUEST_MODULES`, and the design-token allowlists.

**A new guard is mutation-tested.** A new test that scans source must have been seen to fail: break the rule once in the source and watch it go red ([TESTING.md](../../../docs/TESTING.md)). Ask how it was checked. "It passes" is not evidence that it guards anything.

---

## Part 2 — Process

- **CHANGELOG entry present?** Required for every PR, including trivial ones ([CLAUDE.md](../../../CLAUDE.md)). Newest at top, append-only.
- **`[CONTRACT]` flag** if a DTO in [CONTRACTS.md](../../../docs/CONTRACTS.md) changed — and `CONTRACTS.md` updated in the same PR. Check especially for a field whose *unit or meaning* changed without its type changing; nothing fails to compile, so nothing else will catch it.
- **`[MIGRATION]` flag** if `prisma/migrations/` gained a file.
- **Tests for changed logic.** No exception. If the change touches an Invariant, the test is the deliverable — see [TESTING.md](../../../docs/TESTING.md) for the 100% targets.
- **A TRD** if the PR changes architecture or data flow, adds a package, starts a feature, or changes a contract.
- **UX followed** ([ADR-0061](../../../docs/adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)). For each screen the diff adds or changes, open the feature's `ux.md`: every state in its matrix has code that renders it (empty, loading, error, refused and the rest), and the user-facing strings match the copy deck. A missing state is a finding; so is a screen absent from `ux.md`.
- **Scope held.** Work no `R`, `A` or `D` id covers is a finding, as is a decision the code made that `decisions.md` does not record.
- **Decisions read by State.** Code or docs that follow a Q marked `superseded`, `open` or `parked` are a finding: `decided` and `implemented` bind, and a superseded Q defers to the one it names.
- **Decisions kept honest** ([ADR-0062](../../../docs/adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)). A Q the diff implements is marked `implemented`; an `implemented` Q edited in place rather than superseded is a finding; a not-yet-implemented Q superseded rather than replaced is noise to fold back.
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

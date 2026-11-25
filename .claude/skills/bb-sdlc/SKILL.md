---
name: bb-sdlc
description: Operational SDLC flows for bhendi-bazaar. Four subcommands — spec-start (cut a feature to one outcome and scaffold spec.md, decisions.md and trd.md in docs/specs/), ux-start (journeys, a state matrix for every screen, exact copy and a phone-first prototype, signed off by the owner before the TRD), adr-new (add a decision record to docs/adr/ or a domain's adr/), pr-finish (walk the pre-merge checklist). Invoke during the SDLC cycle. Examples — "/bb-sdlc spec-start order-cancellation", "/bb-sdlc ux-start channel-connectors", "/bb-sdlc adr-new switch product search to pg_trgm", "/bb-sdlc pr-finish".
---

# /bb-sdlc — operational SDLC flows

Four subcommands. Pick the one matching the invocation. The cycle they serve is spike → spec → UX → TRD → build → review ([ADR-0061](../../../docs/adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)).

## Rules that run through every subcommand

**Stop the feature growing.** A feature is one outcome a person can see, shippable alone in about six units. You draw the cut; do not ask the owner where it goes. Something is *In* only if an acceptance criterion needs it. A new capability, screen, persona or external dependency is *Later*. Anything waiting on an outside party (an approval, a ticket, a contract) is its own feature. Edge cases and states of what is In are never scope creep: they are required. When a conversation proposes something new mid-feature, say "parked as Q<n>", log it, and carry on. Do not redesign the feature around it.

**Log every decision, and decide the small ones yourself.** Every question goes in the feature's `decisions.md` the moment it comes up, and every answer the moment it is given, including answers given in chat. You decide anything reversible that sits within an existing ADR, marked `Claude · reversible`, with one line of why. The owner decides money, marketplace or legal policy, irreversible data, external commitments and matters of taste. Ask those in batches of at most five, each with your recommendation first. Before ending any planning turn, check that nothing said in the conversation is missing from the log.

**Planning ends in a handoff, never in code** ([ADR-0080](../../../docs/adr/0080-planning-and-building-never-share-a-session.md)). When the TRD is Accepted, this session's last output is the handoff, and then it stops: one line per Delivery unit, each a ready-to-paste prompt (`/bb-build <feature> unit <n>`), marked `after U<k>` or `independent`. The owner starts each in a new session; or, when asked, this session starts them — one new session per unit, sequential units one after another, independent units in parallel only if no two touch the same files, each on its own branch. It does not watch them; each reports when done. Asked to "just start building" here, give the handoff instead and say why.

**Read a decision's State before relying on it**, every time, in planning, writing a TRD, building or reviewing:
- `decided` — binding; act on it. Not yet built.
- `implemented` — binding, and code depends on it.
- `superseded by Qn` — void; follow Qn, and read *its* State too.
- `open` — not decided; do not act on a guess. Ask, or default it if it is yours to decide.
- `parked` — out of this feature's scope; do not build it.

A document that cites a Q id (spec, ux, TRD, code comment) inherits that Q's State: citing a superseded Q is a defect to fix in the same change.

**Changing a decision** ([ADR-0062](../../../docs/adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)):
- **Not yet implemented** (`open`, `decided`, `parked`): replace it **in place**. Overwrite answer, decider, date and why; end the why with `was: <old answer>`. Same id, no new row, so every citation stays right.
- **Implemented**: never edit it. Add a new row with the new answer and set the old row's State to `superseded by Qn`.

## Where docs live

- **Project-wide:** `docs/` — `ARCHITECTURE.md`, `CONTRACTS.md` (+ `contracts/<domain>.md`), `BACKLOG.md`, `DEPENDENCIES.md`, `TESTING.md`, `OPERATIONS.md`, `INTEGRATIONS.md`, `adr/`, `specs/`.
- **Domain-internal:** co-located with the code — `<domain>/CLAUDE.md`, `<domain>/ARCHITECTURE.md`, `<domain>/adr/`. No changelog: history is `git log` ([ADR-0078](../../../docs/adr/0078-the-changelog-is-retired-and-the-commit-subject-is-the-record.md)).
- **Directory rules:** `src/components/CLAUDE.md` (front end), `src/app/api/CLAUDE.md` (route handlers).

When something below says "the relevant `ARCHITECTURE.md`", choose by scope: one domain → that domain's; crossing domains → `docs/`.

---

## Subcommand: `spec-start <feature-name>`

Scaffolds a feature folder under `docs/specs/`. Convention: [ADR-0010](../../../docs/adr/0010-spec-convention.md).

### Steps

1. **Name it.** `kebab-case`, descriptive, **no number**. One feature per folder. Once steps 2–4 pass, scaffold it: `npm run spec:new -- <feature>[/<sub>] --domain <d> --phase <p>` writes `spec.md`, `decisions.md` and `trd.md` from the templates and regenerates the specs index ([ADR-0081](../../../docs/adr/0081-the-mechanical-steps-of-the-cycle-are-scripts.md)).
2. **Check for overlap.** Scan `docs/specs/` for an existing or obviously adjacent folder. If the work belongs to an existing feature, add a **subfeature subfolder** rather than a second top-level folder.
3. **Confirm it is a requirement, not a defect.** A spec states what must be true. If the rule is already stated in an ADR and the work is simply making the code obey it, **no spec is needed** — that is a PR. Push back rather than scaffolding a spec whose content would be a bug report; a spec should still read correctly after the work lands.
4. **Cut the scope** by the rule above, before writing anything. Write the outcome as one sentence. If it needs "and" to join two outcomes, it is two features; scaffold the first and park the second.
5. **Fill `decisions.md`** with every question already raised, including in the conversation that led here:

Template: `scripts/templates/spec/decisions.md` — already in the folder `spec:new` made; fill it, don't re-type it.

6. **Write `spec.md` — requirements and product approach only.** No technical approach, package choices, data-model or algorithm decisions. Those go in the TRD. Frame requirements as properties of the product, in language that survives the implementation.

Template: `scripts/templates/spec/spec.md` — already in the folder `spec:new` made; fill it, don't re-type it.

7. **If the feature has UI, run `ux-start` next.** The TRD waits for the owner's UX sign-off.
8. **Confirm a spike exists before the TRD.** A TRD captures technical decisions and should rest on something — a `/bb-brainstorm`, an existing ADR, or a genuine constraint. If the feature is non-trivial and nothing has been investigated, offer `/bb-brainstorm` first.

Template: `scripts/templates/spec/trd.md` — already in the folder `spec:new` made; fill it, don't re-type it.

9. **Enforce the cap.** ≤100 **readable** lines for `spec.md` only (`ux.md`, `trd.md` and `decisions.md` are uncapped, [ADR-0071](../../../docs/adr/0071-only-the-spec-is-line-capped.md)) — prose only, excluding front-matter, headings, table rows, fenced blocks, link-only lines, and blanks. Over the cap → split into subfeatures. Count it; don't estimate.
10. **Index it.** Give the spec header a one-line `Summary`, run `npm run docs:index` (the specs tables are generated from headers; never type a row; status changes go through `npm run spec:status`), and add the row to `docs/BACKLOG.md` under its phase by hand. Add each parked item to BACKLOG too, so a cut is never a loss.

---

## Subcommand: `ux-start <feature-name>`

The UX stage. It runs after the spec and before the TRD, for any feature a person sees. It exists so the owner meets the experience, edge cases included, on paper rather than in code ([ADR-0061](../../../docs/adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)). A feature with no UI writes "No UI — UX stage skipped" in its spec's Scope and goes straight to the TRD.

### Steps

1. **Read first:** the spec, `decisions.md`, [src/components/CLAUDE.md](../../../src/components/CLAUDE.md), the design tokens in `src/app/globals.css`, and the existing pages the feature touches. A new screen should look like it already belongs in the app.
2. **Write the journeys:** one per thing a person sets out to do, as numbered steps from the screen they start on to the screen that confirms it. Include the journey where it goes wrong.
3. **List every screen:** new or changed, its route, how a person reaches it, and the spec ids it serves.
4. **Fill a state matrix for every screen.** Each row is a state, with what the person sees, the exact copy, and the one action offered. Mark a state that cannot occur "n/a — why". Never leave a row blank. The rows:

| State | Ask |
|---|---|
| First use | Nothing set up yet. What explains the screen and offers the first step? |
| Empty | Set up, but no items. |
| Loading | First load, and a background refresh. |
| Partial | Some items done or failed, some not. |
| Success | Done. What confirms it, and where does the person go next? |
| Retryable error | Network, timeout or a 429 from a provider. Retry offered. |
| Terminal error | Cannot succeed without a change. What to change, and where. |
| Refused | Not allowed, a limit reached, or a conflict with another record. Why, and what to do. |
| Stale | Data older than it should be. How old, and how to refresh. |
| Long content | The longest realistic name or value. Truncate or wrap? |
| Many items | Hundreds of rows. Search, filter, paginate? |
| Slow | A response slower than three seconds. What shows meanwhile? |
| Phone / tablet / desktop | What `md:` and `lg:` change ([ADR-0050](../../../docs/adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md)). |

5. **Write the copy deck:** every button, toast, banner, empty state and error, as it will appear. Use plain words a seller would use, and say what to do next. Buttons are never disabled; an unavailable action explains itself on tap ([ADR-0053](../../../docs/adr/0053-readiness-advises-and-never-gates.md)).
6. **Build the prototype:** a private artifact of phone-width screens, with every journey and the important states drawn, using the app's own tokens. Link it from `ux.md`.
7. **Log what the UX raised.** Every new question goes in `decisions.md`; decide the reversible ones. Ask the owner the rest, at most five, with a recommendation each.
8. **Get the sign-off.** The owner reviews the prototype. Record their changes, then the line `Signed off by <owner>, YYYY-MM-DD` in `ux.md`. The TRD may be written as a draft before this, but cannot be Accepted without it.

```markdown
# UX — <feature>

- **Status:** Draft / Signed off
- **Verified:** YYYY-MM-DD
- **Prototype:** <artifact link>
- **References:** spec.md, decisions.md

## Journeys
## Screens
## State matrix — <screen>   (one table per screen)
## Copy deck
## Sign-off
```

9. **No line cap** ([ADR-0071](../../../docs/adr/0071-only-the-spec-is-line-capped.md)). Put the states in tables so each reads at a glance.

---

## Subcommand: `adr-new <title>`

Adds an immutable decision record. Format and rules: [docs/adr/README.md](../../../docs/adr/README.md).

### Steps

1. **Choose scope.** Cross-domain or project-wide → `docs/adr/`. Internal to one domain → that domain's `adr/`. Each sequence numbers independently from 0001.
2. **Check it is a decision, not a task.** An ADR records a choice between alternatives that constrains future work. If there were no real alternatives, it is not an ADR.
3. **Create it:** `npm run adr:new -- "Title"` (add `--dir server/<domain>/adr` for a domain). It numbers the file, writes the template and regenerates the index; keep the title short, it becomes the filename.
4. **Write it.** Context is 2–4 sentences and reads as well in a year. **An ADR with no rejected alternative is not recording a decision** — include the option a reasonable person would have chosen and say why it lost. Consequences say honestly what gets harder. Set `Status` to Accepted when the owner agrees.
5. **Run `npm run docs:index`** after changing the title or status; a typed index row fails `docs:check`.
6. **To reverse a past decision:** write a new ADR, then edit **only** the old one's `Status` line to `Superseded by ADR-NNNN` and add a pointer. Never edit a past Context, Decision, or Alternatives.
7. **If the decision sets a standing convention**, add a one-line pointer to the conventions index, `docs/CONVENTIONS.md` (the root `CLAUDE.md` points every session at it). A rule that lives only in an ADR will not be followed — ADRs are not loaded into a session.

---

## Subcommand: `pr-finish`

Walks the pre-merge gate. Report each item as pass, fail, or not-applicable — do not fix silently.

1. **`/bb-review` has been run** and its findings addressed. If not, run it now; this is the substantive check and the rest is bookkeeping.
2. **Tests exist** for changed logic.
3. **`npm run gate` passes** — typecheck, unit tests with `docs:check`, and `lint:boundary`, the blocking lint in CI — and `npm run test:integration` against the disposable database.
4. **Lint.** `npm run lint` introduces no new errors (advisory).
5. **Commit subjects** read as history — `<area>: <what changed>`, `[CONTRACT]` if a DTO changed, `[MIGRATION]` if a migration was added.
6. **A TRD exists** if the PR changes architecture or data flow, adds a package, starts a feature, or changes a contract.
7. **Docs updated** where they are now wrong: the relevant `ARCHITECTURE.md` if structure changed, the domain's `docs/contracts/<domain>.md` if a DTO changed, `DEPENDENCIES.md` if a package was added, `OPERATIONS.md` if setup or deploy changed. Bump each touched doc's `Verified:` date.
8. **UX and decisions honoured.** A screen this PR adds or changes appears in `ux.md` with its states and copy. No decision the PR depends on is still open in `decisions.md`.
9. **Spec status moved** if this PR completed one — `Draft` → `Implemented` in the spec and in `docs/specs/README.md`, and the row in `BACKLOG.md`.
10. **No findings written into docs.** Defects fixed in this PR should leave no trace as documentation; the commit records what changed, and that is enough.
11. **Branch is not `main`.** Commit each PR-sized unit on `develop` (or the branch the user named). Push the working branch when the unit is committed; never push to `main` or force-push, and open a PR only when the user asks in this conversation.

Report the checklist with its verdicts, then state plainly whether the PR is ready.

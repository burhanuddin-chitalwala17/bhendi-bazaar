# ADR-0061: A feature is cut to one outcome, its decisions are logged, and its UX is signed off before the TRD

- **Date:** 2026-10-18
- **Status:** Accepted (D2 amended by [ADR-0062](0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md))
- **Context:** The cycle in [ADR-0010](0010-spec-convention.md) goes spec → TRD → build. Three things kept failing in it, all visible in the channel connectors work of 2026-10-15. **Scope grew while planning:** connecting two marketplaces became import, two-way sync, instant notifications and publishing in one conversation, because nothing said where a feature ends. **Decisions were lost:** they were asked and answered in chat, some answered twice, some never, and the TRD's *Open questions* held only the ones that happened to be written down. **Screens were decided while coding:** neither the spec (what must be true) nor the TRD (how it is built) shows what a person will see in each state. The owner only met the experience once it existed, which is the most expensive point to change it.
- **Decision:**
  1. **One outcome per feature, cut before the spec is written.** A feature is one outcome a person can see, shippable alone in about six units or fewer. The spec gains a **Scope** section with an *In* list and a *Later* list. Claude draws the cut, by four rules:
     - In only if an acceptance criterion needs it.
     - A new capability, screen, persona or external dependency not needed for the outcome goes to Later.
     - Anything waiting on an outside party (an approval, a ticket, a contract) is its own feature.
     - Edge cases and states of what is In are never scope creep; they are required.
     Later items are written to the feature's decision log and to `docs/BACKLOG.md`, so a cut is a deferral, not a loss.
  2. **Every decision lives in `decisions.md` in the feature folder**, append-only and uncapped. Each entry has an id (`Q<n>`), the question, the answer, who decided it, the date and one line of why. Entries are *open*, *decided* or *parked*.
     - **Claude decides by default** anything reversible and already within an ADR, and marks it `Claude · reversible`.
     - **The owner decides** money, marketplace or legal policy, irreversible data, external commitments and matters of taste. These are asked in batches of at most five, each with a recommendation.
     - A decision made in conversation is not made until it is in the log. The spec's, UX's and TRD's open questions cite `Q` ids rather than restating them.
  3. **A UX stage sits between spec and TRD** for any feature with UI. It produces three things:
     - **`ux.md`** (≤100 readable lines of prose; tables uncapped). It holds the journeys, a screen inventory, a **state matrix** for every screen, and the exact copy for buttons, toasts, banners and errors. The matrix covers first use, empty, loading, partial, success, retryable error, terminal error, refused, stale data, long content, many items, slow network, and phone, tablet and desktop.
     - **A phone-first prototype** published as a private artifact and linked from `ux.md`.
     - **The owner's sign-off**, dated, in `ux.md`.
     The TRD's *UI approach* cites `ux.md` instead of inventing screens. A feature with no UI says so in one line and skips the stage.
  4. **The skills enforce it.**
     - `/bb-sdlc spec-start` scaffolds the Scope section and `decisions.md`.
     - `/bb-sdlc ux-start` scaffolds `ux.md` and the prototype.
     - `/bb-build` refuses a feature with open decisions, or with UI and no signed-off `ux.md`, and its acceptance report walks every state in the matrix.
     - `/bb-review` checks built screens against `ux.md`: each state reachable, copy as written.
  5. **Trial:** `channel-connectors` is the first feature through the new cycle.
- **Alternatives considered:**
  - *Screens in the TRD's UI section, as today* — rejected. The TRD is written for building, after the shape is fixed; a layout described in prose is not something the owner can react to, and it has no room for a state matrix.
  - *Design in Figma or a separate design tool* — rejected for now. It splits the source of truth from the repository and is a second tool for a solo developer. A prototype page beside the spec needs nothing new, and Figma remains an option if a designer joins.
  - *Open questions at the bottom of each document, as today* — rejected. They were scattered across three files and conversation, and closed ones vanished. One append-only log per feature is the fix the field uses: decision logs and ADRs at feature scale.
  - *The owner decides everything* — rejected. Twenty small questions per feature is how answers got lost. Defaulting the reversible ones, labelled and still overridable, keeps the owner's attention for the calls only the owner can make.
  - *No scope rule, judge per feature* — rejected. Judgement in the moment is what let connectors grow fourfold, much as the uncapped docs in ADR-0010 grew.
- **Consequences:**
  - ✅ A feature has a visible edge, and what falls outside it is parked where it will be found.
  - ✅ The owner sees and corrects the experience, edge cases included, before any of it is built.
  - ✅ No decision is answered twice or lost; the log shows who decided what and why.
  - ⚠️ One more document and one more review per UI feature. That is the intended trade for catching UX changes on paper rather than in code.
  - ⚠️ Claude's default decisions can be wrong. Each is labelled and reversible, and the owner reads the log at each review.

# ADR-0057: Shared hooks live in one core folder, and every other hook travels with its component

- **Date:** 2026-10-05
- **Status:** Accepted. Amends [ADR-0031](0031-one-components-home-organised-by-domain.md) decision 4.

## Context

[ADR-0031](0031-one-components-home-organised-by-domain.md) D4 said a component's hooks travel with it. [ADR-0048](0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md) made hooks the behaviour layer and named `useServerForm`, `useMutation` and `useAsyncData` without saying where they live. On 2026-10-05 `src/hooks/` held 20 hooks in seven folders: a `core/` of genuinely shared ones, four domain folders mirroring `server/`, one audience folder (`admin/`, the axis ADR-0031 D2 rejected), and three at the root. Nine of the twenty had exactly one importer, in one domain's component folder. Nothing tested any of it; `ui-primitives`' dissolution list stopped at components.

## Decision

1. **`src/hooks/core/` is the only shared hooks home.** A hook belongs there when it knows nothing about a domain: `useServerForm`, `useMutation`, `useAsyncData`, `useDebounce`, `useDebouncedSearch`, `useMediaQuery`, `useLocalPreviews`, `useShare`, `useClickOutside`, `useFormPersist`. It is the hooks analogue of `components/ui/` and `components/shared/`.
2. **Every other hook lives beside the component that calls it**, in that component's domain folder, as ADR-0031 D4 always said. A hook used by two domains moves to the one that owns the concept, or to `core/` if it has stopped knowing about either.
3. **No hooks folder is organised by domain or audience.** `src/hooks/<anything but core>` is dissolved, and a test keeps it that way.
4. **A hook does one thing** ([CLAUDE.md](../../CLAUDE.md)). A hook that fetches *and* holds form state is two hooks with the seam in the wrong place.

## Alternatives considered

- **Keep `src/hooks/<domain>/`, mirroring `server/<domain>/`.** Symmetric and tidy. Rejected: it splits a feature across two trees for no caller's benefit; the component is the only thing that knows the hook exists, and "a feature folder is the unit that moves" (ADR-0031 D4) is what made the last reorganisation a rename rather than a rewrite.
- **Co-locate everything, including the core hooks.** Rejected: `useServerForm` has 30 importers across every domain; it would need a fake domain to live in, which is what `core/` is without pretending.
- **Leave it; it is only placement.** Rejected because the audience folder had already appeared (`hooks/admin/`), and placement by audience is the first step back to `src/admin/`.

## Consequences

- ✅ "Where does this hook go" has a two-branch answer, and a test gives the second branch teeth.
- ✅ A feature's hook, client and component are one folder again, so a moved feature moves whole.
- ⚠️ Nine moves and their import rewrites now; `tsc` carries the risk, not people.

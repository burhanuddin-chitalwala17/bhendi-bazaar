# ADR-0054: A channel mapping carries a checked date and source, and required-ness is data

- **Date:** 2026-10-05
- **Status:** Accepted. Amends [ADR-0045](0045-channel-mappings-are-versioned-data.md) decisions 2 and 5 and [ADR-0042](0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md) decision 2.

## Context

[ADR-0045](0045-channel-mappings-are-versioned-data.md) made channel mappings data and over-specified two details before the data existed. D2 said every mapping carries a *version*; D5 said mappings are editable by the owner, "not only by deploy". [ADR-0042](0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md) D2 said a channel's required and extra fields are declared *by its adapter, as a schema*.

What shipped ([channel-registry](../specs/channel-registry/) D4, D7, D8; `ChannelCategoryMap`, `ChannelAttributeMap`, `ChannelValueMap`) is a `checkedOn` date and a `checkedSource` on every row, a `required` column on the attribute map, an admin surface for value mappings and "not sold here", and category and attribute mappings shipped as data migrations. Three ADR sentences now disagree with three tables that work.

## Decision

1. **A mapping carries the date it was last checked and what it was checked against — never a version number.** A mapping is a claim about somebody else's system; the honest metadata is *when* and *where* the claim was last true. A version implies a changelog nobody keeps.
2. **Whether a channel requires a field is a column on the attribute map** (`ChannelAttributeMap.required`), not code in an adapter. It changes when a platform's template changes, which is a data fact with a date, and it is read by readiness ([ADR-0053](0053-readiness-advises-and-never-gates.md)) as advice.
3. **An adapter's declared schema governs only the channel's own extras** — the facts a shop cannot answer from the product (ADR-0042 D3–D5, ADR-0047 D3). Required-ness of *shared* facts is data under decision 2.
4. **The owner edits value mappings and "not sold here" in the console today; category and attribute mappings ship as data migrations until an admin surface exists.** ADR-0045 D5's intent stands as a backlog item, not as a description of the code. A migration per platform re-mapping is accepted for now because the mappings change rarely and each change is reviewed.

## Alternatives considered

- **A semantic version per mapping** (ADR-0045 D2 as written). Rejected: a version without a changelog is a date with less information; nobody would bump it honestly.
- **Required sets in adapter code** (ADR-0042 D2 as written). Rejected: the first Flipkart audit found required-ness per *node* (a bag asks for a number of compartments; a kurta does not), which is exactly the shape of a mapping row and exactly the shape code handles badly.
- **Build the full admin editor now** to honour D5 before any seller needs it. Rejected on YAGNI; three platforms' mappings have been written once each.

## Consequences

- ✅ Every mapping says when it was last believed true; a readiness warning can show that date.
- ✅ Required-ness is auditable in SQL and changes without a deploy once the editor exists.
- ⚠️ Until then a platform's template change costs a migration. The trigger for building the editor is the second re-mapping of the same channel.
- ⚠️ ADR-0045 and ADR-0042 must be read with this amendment; their Status lines point here.

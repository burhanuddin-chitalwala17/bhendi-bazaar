# ADR-0053: Readiness advises and never gates

- **Date:** 2026-10-05
- **Status:** Accepted. Supersedes [ADR-0045](0045-channel-mappings-are-versioned-data.md) decision 3.

## Context

[ADR-0045](0045-channel-mappings-are-versioned-data.md) D3 said "an unmapped value fails the readiness gate; it is never guessed." The first implementation of the [channel registry](../specs/channel-registry/) followed it: the publish action refused a product whose category was only a nearest fit or whose value had no mapping. On 2026-10-04 the owner reversed that (spec R7, TRD D10, D12, D13), and the code followed (`server/catalog/channel-readiness.ts`). The ADR did not, and the always-loaded rules still said "fails readiness" a day later. A reversal that lives in a spec and a code comment will be "fixed" back by the first reader of the ADR.

The reason is evidence. Every "required" we know about comes from reading a platform's template, not from watching a submission fail. A gate built on an untested idea of required would refuse listings that would have gone through, and we would never learn which, because a refused listing is never submitted.

## Decision

1. **Readiness advises. Nothing in the product refuses a publish, disables a control, or hides a button because of it.** It is shown wherever the product is — the product page, the list, the register — as what each channel *would make of* the product.
2. **States are named for what the other side will think, never for what we forbid.** `incomplete`, `nearest fit`, `unmapped value` — not `blocked`, `invalid`, `not allowed`. A tap on the state shows the reason and what would change it.
3. **A nearest fit is the platform's decision, shown to every shop it affects** (D12). It is a warning on every product under it, not an approval taken once.
4. **"Not sold here" is written down** (D13). An absent mapping already means "nobody has decided"; a type a channel does not carry is a row that says so, and it silences the worklist on purpose.
5. **What would justify a gate:** a watched submission to that channel, rejected for a named field, recorded in [INTEGRATIONS.md](../INTEGRATIONS.md) with the date. A gate added on that evidence is a new decision, per channel, per field — never a return to a blanket rule.

## Alternatives considered

- **Gate on required fields** (ADR-0045 D3, the first build). The conventional marketplace-tool answer; every listing SaaS does it. Rejected because their required sets come from watching millions of submissions and ours come from reading a template once. We are not in a position to refuse on their behalf, and a refusal teaches us nothing.
- **Gate per channel, advise elsewhere.** Tempting for Amazon, where the template is the contract. Rejected for now by D5: the same evidence bar applies to every channel; Amazon simply reaches it first if anyone does.
- **Hide the publish control until ready.** Softer than a refusal and worse: a control that disappears has no reason attached, so the shop cannot find out what to fix.

## Consequences

- ✅ A shop can always act. The worst outcome of bad readiness data is an unhelpful warning, not a blocked sale.
- ✅ Readiness is a pure function over stored data, so the page, the register and the tests cannot disagree about what "incomplete" means.
- ⚠️ A shop *can* publish something a channel will reject. That is the price of learning what the channel actually requires; the rejection is the evidence D5 asks for.
- ⚠️ The word "gate" must leave the code and the docs wherever it meant refusal. `tests/unit/channel-gate.test.ts` keeps its name because it guards the image rule's *time of use*, which is a different question.

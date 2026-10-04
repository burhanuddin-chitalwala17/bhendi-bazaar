/**
 * The gate, as its TRD's test plan names it ([channel-registry](../../docs/specs/channel-registry/)
 * D5, D7): every required fact present; one missing; a value mapped; a value unmapped; a
 * nearest-fit category. Pure, so each is a table row rather than a database.
 */
import { describe, expect, it } from "vitest";

import {
  LISTING_PROBLEM,
  LISTING_READINESS,
  categoryFor,
  enabledChannels,
  listingReadiness,
  readinessByChannel,
  unmappedValues,
  type AttributeMapping,
  type CategoryMapping,
  type ChannelRegister,
  type ListingReadinessReport,
} from "@server/catalog/channel-readiness";
import { FACT, LIST, ORIGIN, type StoredFacts } from "@server/catalog/listing-facts";
import { CHANNEL, CHANNELS } from "@server/shared/channels";

const exactCategory: CategoryMapping = {
  kind: null,
  theirCategory: "ethnic-wear/abaya",
  fit: "EXACT",
  note: null,
};

const facts = (answers: Record<string, string | number | boolean>): StoredFacts =>
  Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [key, { value, origin: ORIGIN.PRODUCT }]),
  ) as StoredFacts;

const register = (overrides: Partial<ChannelRegister> = {}): ChannelRegister => ({
  categories: [exactCategory],
  attributes: [
    { fact: FACT.COLOUR, theirAttribute: "Color", required: true },
    { fact: FACT.MATERIAL, theirAttribute: "Fabric", required: true },
  ] satisfies AttributeMapping[],
  mappedValues: new Map([
    [LIST.COLOUR, new Set(["maroon", "black"])],
    [LIST.MATERIAL, new Set(["cotton"])],
  ]),
  ...overrides,
});

const answered = facts({ [FACT.COLOUR]: "maroon", [FACT.MATERIAL]: "cotton" });

describe("a product that answers everything the channel asks", () => {
  it("is ready, with nothing to say about it", () => {
    const report = listingReadiness({ kind: null, facts: answered }, register());
    expect(report.state).toBe(LISTING_READINESS.READY);
    expect(report.problems).toEqual([]);
    expect(report.theirCategory).toBe("ethnic-wear/abaya");
  });

  it("ignores a fact the channel does not ask for — not sending it is not a gap", () => {
    const extra = { ...answered, ...facts({ [FACT.OCCASION]: "wedding" }) };
    expect(listingReadiness({ kind: null, facts: extra }, register()).state).toBe(
      LISTING_READINESS.READY,
    );
  });
});

describe("a fact the product has not answered", () => {
  it("blocks when the channel refuses a listing without it, naming their word for it", () => {
    const report = listingReadiness(
      { kind: null, facts: facts({ [FACT.COLOUR]: "maroon" }) },
      register(),
    );
    expect(report.state).toBe(LISTING_READINESS.BLOCKED);
    expect(report.problems).toEqual([
      {
        problem: LISTING_PROBLEM.MISSING_FACT,
        fact: FACT.MATERIAL,
        theirAttribute: "Fabric",
      },
    ]);
  });

  it("only warns when the channel accepts its absence", () => {
    const report = listingReadiness(
      { kind: null, facts: facts({ [FACT.COLOUR]: "maroon" }) },
      register({
        attributes: [
          { fact: FACT.COLOUR, theirAttribute: "Color", required: true },
          { fact: FACT.MATERIAL, theirAttribute: "Fabric", required: false },
        ],
      }),
    );
    expect(report.state).toBe(LISTING_READINESS.WARNED);
    expect(report.problems[0]?.problem).toBe(LISTING_PROBLEM.MISSING_OPTIONAL_FACT);
  });

  // Blank is not an answer, and the rule for that is `fill-facts`' — a second spelling here is
  // how a fact counts as answered in one place and missing in the other.
  it("counts a blank string as unanswered", () => {
    const report = listingReadiness(
      { kind: null, facts: facts({ [FACT.COLOUR]: "maroon", [FACT.MATERIAL]: "   " }) },
      register(),
    );
    expect(report.state).toBe(LISTING_READINESS.BLOCKED);
    expect(report.problems[0]?.problem).toBe(LISTING_PROBLEM.MISSING_FACT);
  });

  it("reports every missing fact at once, not the first", () => {
    const report = listingReadiness({ kind: null, facts: {} }, register());
    expect(report.problems.map((entry) => entry.problem)).toEqual([
      LISTING_PROBLEM.MISSING_FACT,
      LISTING_PROBLEM.MISSING_FACT,
    ]);
  });
});

describe("an answer the channel has no word for", () => {
  it("blocks, naming the list and our key so one fix serves every product", () => {
    const report = listingReadiness(
      { kind: null, facts: facts({ [FACT.COLOUR]: "ochre", [FACT.MATERIAL]: "cotton" }) },
      register(),
    );
    expect(report.state).toBe(LISTING_READINESS.BLOCKED);
    expect(report.problems).toEqual([
      {
        problem: LISTING_PROBLEM.UNMAPPED_VALUE,
        fact: FACT.COLOUR,
        list: LIST.COLOUR,
        value: "ochre",
      },
    ]);
  });

  it("blocks on an unlisted answer, which can have no mapping by construction", () => {
    const report = listingReadiness(
      {
        kind: null,
        facts: {
          ...answered,
          [FACT.COLOUR]: { value: "maroon", origin: ORIGIN.PRODUCT, unlisted: true },
        },
      },
      register(),
    );
    expect(report.problems[0]?.problem).toBe(LISTING_PROBLEM.UNMAPPED_VALUE);
  });

  it("blocks when the channel has no words for that list at all", () => {
    const report = listingReadiness(
      { kind: null, facts: answered },
      register({ mappedValues: new Map() }),
    );
    expect(report.problems).toHaveLength(2);
    expect(report.state).toBe(LISTING_READINESS.BLOCKED);
  });

  // The mapping is per channel: Google's vocabulary saying nothing about maroon is not Meesho's
  // problem, which is why the register is an input rather than a lookup inside.
  it("does not ask for a mapping where the answer is free text or a number", () => {
    const report = listingReadiness(
      { kind: null, facts: facts({ [FACT.SHELF_LIFE_MONTHS]: 24 }) },
      register({
        attributes: [{ fact: FACT.SHELF_LIFE_MONTHS, theirAttribute: "Shelf Life", required: true }],
        mappedValues: new Map(),
      }),
    );
    expect(report.state).toBe(LISTING_READINESS.READY);
  });
});

describe("a category that is only the nearest they have", () => {
  const nearest: CategoryMapping = {
    kind: "rida",
    theirCategory: "ethnic-wear/abaya",
    fit: "NEAREST",
    note: "Flipkart has no rida node; abaya is where buyers look.",
  };

  // Blocking would make this shop's largest line unlistable. It is shown every time instead —
  // approved once and forgotten is the failure D6 exists for.
  it("warns rather than blocks, and says what it will be listed as and why", () => {
    const report = listingReadiness(
      { kind: "rida", facts: answered },
      register({ categories: [nearest] }),
    );
    expect(report.state).toBe(LISTING_READINESS.WARNED);
    expect(report.problems).toEqual([
      {
        problem: LISTING_PROBLEM.NEAREST_CATEGORY,
        theirCategory: "ethnic-wear/abaya",
        note: nearest.note,
      },
    ]);
    expect(report.theirCategory).toBe("ethnic-wear/abaya");
  });

  it("is still outranked by anything blocked beside it", () => {
    const report = listingReadiness(
      { kind: "rida", facts: facts({ [FACT.COLOUR]: "maroon" }) },
      register({ categories: [nearest] }),
    );
    expect(report.state).toBe(LISTING_READINESS.BLOCKED);
    expect(report.problems).toHaveLength(2);
  });
});

describe("the kind decides which of the type's categories applies", () => {
  const catchAll: CategoryMapping = { ...exactCategory, kind: null, theirCategory: "clothing" };
  const rida: CategoryMapping = {
    kind: "rida",
    theirCategory: "ethnic-wear/abaya",
    fit: "NEAREST",
    note: "No rida node; abaya is where buyers look.",
  };

  it("takes the kind's own mapping, warning because that one is a nearest fit", () => {
    const report = listingReadiness(
      { kind: "rida", facts: answered },
      register({ categories: [catchAll, rida] }),
    );
    expect(report.state).toBe(LISTING_READINESS.WARNED);
    expect(report.theirCategory).toBe("ethnic-wear/abaya");
  });

  it("takes the catch-all for a kind nothing names, and is ready on it", () => {
    const report = listingReadiness(
      { kind: "abaya", facts: answered },
      register({ categories: [catchAll, rida] }),
    );
    expect(report.state).toBe(LISTING_READINESS.READY);
    expect(report.theirCategory).toBe("clothing");
  });
});

describe("a type with nowhere to go", () => {
  it("blocks, and names no category, because there is none to name", () => {
    const report = listingReadiness({ kind: null, facts: answered }, register({ categories: [] }));
    expect(report.state).toBe(LISTING_READINESS.BLOCKED);
    expect(report.problems).toEqual([{ problem: LISTING_PROBLEM.NO_CATEGORY }]);
    expect(report.theirCategory).toBeNull();
  });
});

describe("picking the mapping that applies to a kind", () => {
  const catchAll: CategoryMapping = { ...exactCategory, kind: null, theirCategory: "clothing" };
  const named: CategoryMapping = { ...exactCategory, kind: "rida", theirCategory: "clothing/rida" };

  it("prefers the one naming the kind over the type's catch-all", () => {
    expect(categoryFor([catchAll, named], "rida")).toBe(named);
    // Order must not decide it: a listing is not allowed to depend on which row came back first.
    expect(categoryFor([named, catchAll], "rida")).toBe(named);
  });

  it("falls back to the catch-all for a kind nothing names", () => {
    expect(categoryFor([catchAll, named], "abaya")).toBe(catchAll);
    expect(categoryFor([catchAll, named], null)).toBe(catchAll);
  });

  it("answers null when neither exists, rather than guessing", () => {
    expect(categoryFor([named], "abaya")).toBeNull();
    expect(categoryFor([], null)).toBeNull();
  });
});

describe("the unmapped values, gathered into a worklist", () => {
  const report = (...problems: ListingReadinessReport["problems"]): ListingReadinessReport => ({
    state: LISTING_READINESS.BLOCKED,
    problems,
    theirCategory: null,
  });

  const missing = (list: string, value: string, fact: typeof FACT.COLOUR | typeof FACT.MATERIAL) =>
    ({ problem: LISTING_PROBLEM.UNMAPPED_VALUE, list, value, fact }) as const;

  it("counts products per value, not rows, so a finite job looks finite", () => {
    const work = unmappedValues([
      report(missing(LIST.COLOUR, "ochre", FACT.COLOUR)),
      report(missing(LIST.COLOUR, "ochre", FACT.COLOUR)),
      report(missing(LIST.MATERIAL, "tussar", FACT.MATERIAL)),
    ]);

    expect(work).toEqual([
      { list: LIST.COLOUR, value: "ochre", facts: [FACT.COLOUR], products: 2 },
      { list: LIST.MATERIAL, value: "tussar", facts: [FACT.MATERIAL], products: 1 },
    ]);
  });

  it("counts one product once, however many of its facts hit the same value", () => {
    const work = unmappedValues([
      report(missing(LIST.COLOUR, "ochre", FACT.COLOUR), missing(LIST.COLOUR, "ochre", FACT.MATERIAL)),
    ]);
    expect(work).toHaveLength(1);
    expect(work[0].products).toBe(1);
    expect(work[0].facts).toEqual([FACT.COLOUR, FACT.MATERIAL]);
  });

  it("puts the value blocking the most products first", () => {
    const work = unmappedValues([
      report(missing(LIST.MATERIAL, "tussar", FACT.MATERIAL)),
      report(missing(LIST.COLOUR, "ochre", FACT.COLOUR)),
      report(missing(LIST.COLOUR, "ochre", FACT.COLOUR)),
    ]);
    expect(work.map((entry) => entry.value)).toEqual(["ochre", "tussar"]);
  });

  it("ignores every other kind of problem", () => {
    expect(unmappedValues([report({ problem: LISTING_PROBLEM.NO_CATEGORY })])).toEqual([]);
    expect(unmappedValues([])).toEqual([]);
  });
});

describe("the channels a shop sells on", () => {
  it("takes the ones it turned on, and nothing it did not", () => {
    expect(
      enabledChannels([
        { channel: CHANNEL.MEESHO, enabled: true },
        { channel: CHANNEL.FLIPKART, enabled: false },
      ]),
    ).toEqual([CHANNEL.MEESHO]);
  });

  // D2: deciding nothing is a decision to sell nowhere else, not a question to be nagged with.
  it("treats an absent row as off", () => {
    expect(enabledChannels([])).toEqual([]);
  });

  it("drops a stored key that is no longer a channel", () => {
    expect(enabledChannels([{ channel: "instagram", enabled: true }])).toEqual([]);
  });

  it("answers in display order, whatever order the rows arrive in", () => {
    const rows = [...CHANNELS].reverse().map((channel) => ({ channel, enabled: true }));
    expect(enabledChannels(rows)).toEqual([...CHANNELS]);
  });
});

describe("readiness across a shop's channels", () => {
  it("answers one report per channel asked about, in display order", () => {
    const answers = readinessByChannel(
      { kind: null, facts: answered },
      new Map([
        [CHANNEL.MEESHO, register()],
        [CHANNEL.GOOGLE, register({ categories: [] })],
      ]),
    );

    expect(answers.map((entry) => entry.channel)).toEqual([CHANNEL.GOOGLE, CHANNEL.MEESHO]);
    expect(answers[0].report.state).toBe(LISTING_READINESS.BLOCKED);
    expect(answers[1].report.state).toBe(LISTING_READINESS.READY);
  });

  // A6: a shop that sells only here is warned about nowhere else.
  it("says nothing at all when the shop has enabled nothing", () => {
    expect(readinessByChannel({ kind: null, facts: {} }, new Map())).toEqual([]);
  });
});

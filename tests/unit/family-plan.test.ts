// One family from several listings (family-merge D1): the axes, each member's values, what is
// shared, and what stops a save. Listing shapes follow marketplace-facts' reads.
import { describe, expect, it } from "vitest";

import { planFamily, type FamilyMemberInput } from "@server/channels/family-plan";
import type { FillMapping } from "@server/channels/fact-fill";
import { NO_DETAILS, type ListingAttributes } from "@server/channels/providers/listing-read";

const checked = new Date("2026-10-23");
const mapping: FillMapping = {
  types: [{ productType: "trousers", kind: null, theirCategory: "PANTS" }],
  attributes: [
    { theirCategory: "PANTS", fact: "colour", theirAttribute: "color", checkedOn: checked },
    { theirCategory: "PANTS", fact: "material", theirAttribute: "material", checkedOn: checked },
  ],
  values: [],
};
const type = {
  facts: [
    { key: "colour", answer: "choice" as const, list: "colour" },
    { key: "material", answer: "choice" as const, list: "material" },
  ],
  measures: [{ key: "length", unit: "in" }],
};
const lists = {
  colour: ["black", "red", "navy", "blue", "olive"].map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1) })),
  material: [{ key: "cotton", label: "Cotton" }, { key: "crepe", label: "Crepe" }],
};

const read = (colour: string, extra: Partial<ListingAttributes> & { material?: string; lengthCm?: number } = {}): ListingAttributes => ({
  type: "PANTS",
  attributes: { color: [colour], material: [extra.material ?? "Cotton"] },
  details: extra.lengthCm ? { ...NO_DETAILS, dimensionsCm: { length: extra.lengthCm, width: 30, height: 2 } } : NO_DETAILS,
});
const member = (key: string, r: ListingAttributes | null, existing?: FamilyMemberInput["existing"]): FamilyMemberInput => ({ key, read: r, existing });
const plan = (members: FamilyMemberInput[], more: Partial<Parameters<typeof planFamily>[0]> = {}) =>
  planFamily({ members, mapping, productType: "trousers", type, lists, typeAxes: ["colour"], ...more });

describe("a family's axes and members (family-merge D1)", () => {
  it("varies by colour, and fills what every member shares once (spec A1, A2, Q7)", () => {
    const result = plan([member("a", read("Black")), member("b", read("Red")), member("c", read("Navy"))]);
    expect(result.axes).toEqual(["colour"]);
    expect(result.members.map((m) => m.values.colour.value)).toEqual(["black", "red", "navy"]);
    expect(result.shared.facts).toEqual([{ key: "material", value: "cotton", said: "Cotton", fromListing: true }]);
    expect(result.duplicates).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it("adds an axis the listings differ on, beyond the type's, and the owner may remove it (Q16)", () => {
    const members = [member("red", read("Red", { lengthCm: 43.18 })), member("black", read("Black", { lengthCm: 45.72 }))];
    const both = plan(members);
    expect(both.axes).toEqual(["colour", "length"]);
    expect(both.added).toEqual(["length"]);
    expect(both.members.map((m) => [m.values.colour.value, m.values.length.value])).toEqual([["red", 17], ["black", 18]]);

    const removed = plan(members, { removed: ["length"] });
    expect(removed.axes).toEqual(["colour"]);
    expect(removed.members[0].measurements).toEqual([{ key: "length", value: 17, said: "43.18 cm" }]);
  });

  it("keeps a differing fact on each member rather than the family (Q7)", () => {
    const result = plan([member("a", read("Black", { material: "Cotton" })), member("b", read("Red", { material: "Crepe" }))], { removed: ["material"] });
    expect(result.shared.facts).toEqual([]);
    expect(result.members.map((m) => m.facts)).toEqual([[{ key: "material", value: "cotton", said: "Cotton" }], [{ key: "material", value: "crepe", said: "Crepe" }]]);
  });

  it("finds two members that cannot be told apart (spec A5, Q8)", () => {
    const result = plan([member("a", read("Black")), member("b", read("Red")), member("c", read("black"))]);
    expect(result.duplicates).toEqual([["a", "c"]]);
  });

  it("asks a member's unknown colour, lists it as missing, and an answer settles it (Q18)", () => {
    const unanswered = plan([member("a", read("Black")), member("ink", read("Ink"))]);
    expect(unanswered.members[1].questions.map((q) => [q.fact, q.said])).toEqual([["colour", "Ink"]]);
    expect(unanswered.missing).toEqual([{ key: "ink", axis: "colour" }]);

    const answered = plan([member("a", read("Black")), member("ink", read("Ink"))], { answers: { ink: { colour: "navy" } } });
    expect(answered.missing).toEqual([]);
    expect(answered.members[1].values.colour).toEqual({ value: "navy", said: "Ink", from: "answer" });
  });

  it("takes an answer only for a fact that member was asked, never over what its listing said (D3)", () => {
    const result = plan([member("a", read("Black")), member("b", read("Red"))], { answers: { b: { colour: "navy", material: "crepe" } } });
    expect(result.members[1].values.colour.value).toBe("red");
    expect(result.shared.facts).toEqual([{ key: "material", value: "cotton", said: "Cotton", fromListing: true }]);
  });

  it("ignores an answer that is not one of ours, and a member that could not be read is missing", () => {
    const result = plan([member("a", read("Black")), member("b", null)], { answers: { b: { colour: "not-a-colour" } } });
    expect(result.missing).toEqual([{ key: "b", axis: "colour" }]);
  });

  it("keeps an existing product's own answers over its listing's (spec A3, D4)", () => {
    const result = plan([member("a", read("Black")), member("b", read("Black"), { facts: { colour: { value: "olive", origin: "product" } }, measurements: {} })]);
    expect(result.members[1].values.colour).toEqual({ value: "olive", said: null, from: "existing" });
    expect(result.duplicates).toEqual([]);
  });

  it("asks a shared fact once when every member says the same unclear words", () => {
    const members = [member("a", read("Black", { material: "Polyviscose" })), member("b", read("Red", { material: "Polyviscose" }))];
    expect(plan(members).sharedQuestions.map((q) => [q.fact, q.said])).toEqual([["material", "Polyviscose"]]);
    const answered = plan(members, { answers: { "*": { material: "crepe" } } });
    expect(answered.sharedQuestions).toEqual([]);
    expect(answered.shared.facts).toEqual([{ key: "material", value: "crepe", said: "Polyviscose", fromListing: true }]);
  });

  it("asks a member whose listing says nothing on an axis, with every answer, and a length is answered with its number (Q18)", () => {
    const silent: ListingAttributes = { type: "PANTS", attributes: {}, details: NO_DETAILS };
    const result = plan([member("a", read("Black")), member("b", silent)]);
    expect(result.members[1].questions).toEqual([{ fact: "colour", said: "", options: lists.colour }]);
    const lengths = plan([member("a", read("Black", { lengthCm: 43.18 })), member("b", read("Red"))], { typeAxes: ["colour", "length"], answers: { b: { length: "18" } } });
    expect(lengths.members[1].values.length).toEqual({ value: 18, said: null, from: "answer" });
  });

  it("refuses a new member that matches one already in the family, and never pairs two existing ones (Q8, Q20)", () => {
    const existing = (key: string, colour: string) => ({ key, read: null, existing: { facts: { colour: { value: colour } }, measurements: {} } });
    const result = plan([member("new", read("Black"))], { context: [existing("old-black", "black"), existing("old-red", "red"), existing("old-red-2", "red")] });
    expect(result.duplicates).toEqual([["new", "old-black"]]);
    expect(result.members.map((m) => m.key)).toEqual(["new"]);
  });

  it("marks a shared fact the shop typed as not from the listing", () => {
    const existing = { facts: { colour: { value: "olive" }, material: { value: "crepe" } }, measurements: {} };
    const result = plan([member("a", read("Black", { material: "Crepe" })), member("b", read("Red"), existing)]);
    expect(result.shared.facts.find((f) => f.key === "material")).toMatchObject({ value: "crepe", fromListing: false });
  });
});

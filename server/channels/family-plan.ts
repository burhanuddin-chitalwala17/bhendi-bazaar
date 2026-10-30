import type { ListingAttributes } from "./providers/listing-read";
import { planFill, type FactFill, type FactQuestion, type FillMapping, type FillType } from "./fact-fill";

/**
 * Making one family of several marketplace listings (family-merge D1). Pure: which attributes the
 * members differ on (the family's axes), each member's value on them, what all members share, and
 * what stops a save. Each member is planned exactly as one listing fills one product
 * (marketplace-facts D5), so a family never matches an answer differently from a single product.
 */

export type Answerable = string | number | boolean;

export interface FamilyMemberInput {
  /** The listing's id; it names the member everywhere. */
  key: string;
  read: ListingAttributes | null;
  /** An existing product joining as it is: its own answers win (D4). */
  existing?: { facts: unknown; measurements: unknown } | null;
}

export interface MemberValue {
  value: Answerable;
  /** The marketplace's words, when the value came from the listing. */
  said: string | null;
  from: "listing" | "answer" | "existing";
}

export interface FamilyMemberPlan {
  key: string;
  /** Its value on each axis; an axis missing here is asked (`questions`) or unknown. */
  values: Record<string, MemberValue>;
  /** Axis values the listing's words do not settle (Q18). */
  questions: FactQuestion[];
  /** Facts and measurements that differ between members and stay on this one (Q7). */
  facts: FactFill[];
  measurements: FactFill[];
}

/** A shared fact, and whether every member's value came from its listing or the shop typed one. */
export type SharedFill = FactFill & { fromListing: boolean };

export interface FamilyPlan {
  /** The type's axes first, then any other attribute the members differ on (Q16). */
  axes: string[];
  /** The axes added beyond the type's, which the owner may remove. */
  added: string[];
  members: FamilyMemberPlan[];
  /** Facts every member agrees on: filled on the family once (Q7). */
  shared: { facts: SharedFill[]; measurements: SharedFill[] };
  /** A shared fact all members state in the same unclear words: asked once, for the family. */
  sharedQuestions: FactQuestion[];
  /** Members whose axis values are all the same (Q8), a family's existing members included. */
  duplicates: Array<[string, string]>;
  /** Members with an axis left unanswered (Q18). */
  missing: Array<{ key: string; axis: string }>;
}

type Entries = Record<string, { value?: unknown } | undefined>;
const entriesOf = (value: unknown): Entries => (value && typeof value === "object" ? (value as Entries) : {});
const known = (value: unknown): value is Answerable =>
  (typeof value === "string" && value.trim() !== "") || typeof value === "number" || typeof value === "boolean";
const same = (a: Answerable, b: Answerable) => String(a).toLowerCase() === String(b).toLowerCase();

export function planFamily(input: {
  members: readonly FamilyMemberInput[];
  /** A family's members already in it when adding (Q20): they count for axes and duplicates, and are not saved. */
  context?: readonly FamilyMemberInput[];
  mapping: FillMapping;
  productType: string;
  type: FillType;
  lists: Readonly<Record<string, ReadonlyArray<{ key: string; label: string }>>>;
  /** The type's declared axes (ProductFamily.variantAxis is copied from them). */
  typeAxes: readonly string[];
  /** The owner's answers: member key → attribute → our answer's key, or the family's under "*". */
  answers?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Added axes the owner removed as not a real difference (Q16). */
  removed?: readonly string[];
}): FamilyPlan {
  const { mapping, productType, type, lists, typeAxes } = input;
  const contextKeys = new Set((input.context ?? []).map((m) => m.key));
  const members = [...input.members, ...(input.context ?? [])];
  const answers = input.answers ?? {};
  const removed = new Set(input.removed ?? []);
  const facts = new Map(type.facts.map((f) => [f.key, f]));
  const isMeasure = new Set(type.measures.map((m) => m.key));
  const attributes = [...type.facts.map((f) => f.key), ...type.measures.map((m) => m.key)];

  // Each member, planned as one product with no answers of its own, so every listing word is read.
  const planned = members.map((m) => {
    const plan = m.read
      ? planFill({ read: m.read, mapping, product: { productType, facts: {}, measurements: {} }, type, lists, skips: [] })
      : null;
    const own = { ...entriesOf(m.existing?.facts), ...entriesOf(m.existing?.measurements) };
    const value = new Map<string, MemberValue>();
    const question = new Map<string, FactQuestion>();
    for (const attr of attributes) {
      const mine = own[attr]?.value;
      if (known(mine)) {
        value.set(attr, { value: mine, said: null, from: "existing" });
        continue;
      }
      const fill = [...(plan?.facts ?? []), ...(plan?.measurements ?? [])].find((f) => f.key === attr);
      if (fill) value.set(attr, { value: fill.value, said: fill.said, from: "listing" });
      const asked = plan?.questions.find((q) => q.fact === attr);
      if (asked && !fill) question.set(attr, asked);
    }
    return { key: m.key, value, question };
  });

  // An answer counts like a value read, only for a fact this member was asked and only if it is one of ours.
  const valid = (attr: string, key: string | undefined) => {
    if (key === undefined) return false;
    // A measurement is answered with its number, in the type's unit (Q18).
    if (isMeasure.has(attr)) return Number.isFinite(Number(key)) && Number(key) > 0;
    const list = facts.get(attr)?.list;
    return list !== undefined && (lists[list] ?? []).some((o) => o.key === key);
  };
  const asValue = (attr: string, key: string): Answerable => (isMeasure.has(attr) ? Number(key) : key);
  // A member whose listing says nothing on an axis is still asked, with every answer of ours (Q18).
  for (const m of planned) {
    for (const axis of typeAxes) {
      if (m.value.has(axis) || m.question.has(axis)) continue;
      const list = facts.get(axis)?.list;
      m.question.set(axis, { fact: axis, said: "", options: list ? [...(lists[list] ?? [])].slice(0, 30) : [] });
    }
  }
  for (const m of planned) {
    for (const [attr, key] of Object.entries(answers[m.key] ?? {})) {
      if (!m.question.has(attr) || !valid(attr, key)) continue;
      m.value.set(attr, { value: asValue(attr, key), said: m.question.get(attr)?.said || null, from: "answer" });
      m.question.delete(attr);
    }
  }

  // The axes: the type's, then any other attribute on which known values differ (Q16).
  const differs = (attr: string) => {
    const values = planned.map((m) => m.value.get(attr)?.value).filter(known);
    return values.some((v) => !same(v, values[0]));
  };
  const added = attributes.filter((a) => !typeAxes.includes(a) && !removed.has(a) && differs(a));
  const axes = [...typeAxes.filter((a) => attributes.includes(a)), ...added];

  // Shared facts: every member known and agreeing; a shared unclear one is asked once.
  const shared = { facts: [] as SharedFill[], measurements: [] as SharedFill[] };
  const sharedQuestions: FactQuestion[] = [];
  const familyAnswers = answers["*"] ?? {};
  const saving = planned.filter((m) => !contextKeys.has(m.key));
  for (const attr of attributes.filter((a) => !axes.includes(a))) {
    const values = saving.map((m) => m.value.get(attr));
    if (values.length > 0 && values.every((v) => v && known(v.value)) && values.every((v) => same(v!.value, values[0]!.value))) {
      const first = values[0]!;
      const fill = { key: attr, value: first.value, said: first.said ?? "", fromListing: values.every((v) => v!.from === "listing") };
      (isMeasure.has(attr) ? shared.measurements : shared.facts).push(fill);
      continue;
    }
    const asked = saving.map((m) => m.question.get(attr));
    if (values.every((v) => !v) && asked.every((q) => q && q.said.toLowerCase() === asked[0]!.said.toLowerCase())) {
      if (valid(attr, familyAnswers[attr])) shared.facts.push({ key: attr, value: familyAnswers[attr], said: asked[0]!.said, fromListing: true });
      else sharedQuestions.push(asked[0]!);
    }
  }
  const sharedKeys = new Set([...shared.facts, ...shared.measurements, ...sharedQuestions].map((f) => ("key" in f ? f.key : f.fact)));

  const all: FamilyMemberPlan[] = planned.map((m) => {
    const values: Record<string, MemberValue> = {};
    for (const axis of axes) {
      const v = m.value.get(axis);
      if (v) values[axis] = v;
    }
    const own = (keys: Iterable<string>) =>
      [...keys]
        .filter((attr) => !axes.includes(attr) && !sharedKeys.has(attr))
        .flatMap((attr) => {
          const v = m.value.get(attr);
          return v && v.from !== "existing" ? [{ key: attr, value: v.value, said: v.said ?? "" }] : [];
        });
    return {
      key: m.key,
      values,
      questions: axes.flatMap((axis) => (values[axis] ? [] : m.question.has(axis) ? [m.question.get(axis)!] : [])),
      facts: own(type.facts.map((f) => f.key)),
      measurements: own(type.measures.map((x) => x.key)),
    };
  });

  const plans = all.filter((p) => !contextKeys.has(p.key));
  const missing = plans.flatMap((p) => axes.filter((axis) => !p.values[axis]).map((axis) => ({ key: p.key, axis })));
  const duplicates: Array<[string, string]> = [];
  const complete = all.filter((p) => axes.length > 0 && axes.every((a) => p.values[a]));
  for (let i = 0; i < complete.length; i++) {
    for (let j = i + 1; j < complete.length; j++) {
      const bothContext = contextKeys.has(complete[i].key) && contextKeys.has(complete[j].key);
      if (!bothContext && axes.every((a) => same(complete[i].values[a].value, complete[j].values[a].value))) duplicates.push([complete[i].key, complete[j].key]);
    }
  }
  return { axes, added, members: plans, shared, sharedQuestions, duplicates, missing };
}

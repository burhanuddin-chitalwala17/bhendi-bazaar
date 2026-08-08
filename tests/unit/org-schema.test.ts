// Two things this file pins. Server-owned fields: `code` is generated at creation and
// frozen (like a slug), and a new org is active by definition — so neither is accepted
// from a request body, even if a client sends them. And normalisation-before-validation:
// GST and PAN inputs are styled `className="uppercase"`, which is CSS — it changes how a
// value looks, never what it is — so case is normalised before the pattern runs.
import { describe, expect, it } from "vitest";
import { createOrgSchema, orgFormSchema } from "@/lib/validation/schemas/org.schema";
import { orgCodeCandidates, ORG_CODE_PATTERN } from "@server/catalog/org.code";

const org = (overrides: Record<string, unknown> = {}) => ({
  name: "Test Organisation",
  email: "owner@example.com",
  defaultPincode: "560083",
  defaultCity: "Bengaluru",
  defaultState: "Karnataka",
  ...overrides,
});

const parse = (input: unknown) => createOrgSchema.safeParse(input);

describe("server-owned fields never arrive through the body", () => {
  it("strips a client-sent code rather than trusting it", () => {
    const result = parse(org({ code: "EVIL-001" }));
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("code");
  });

  it("strips a client-sent isActive", () => {
    const result = parse(org({ isActive: false }));
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("isActive");
  });

  it("the form schema carries isActive for edit mode, but create parsing still strips it", () => {
    const formResult = orgFormSchema.safeParse(org({ isActive: false }));
    expect(formResult.data?.isActive).toBe(false);
    expect(parse(org({ isActive: false })).data).not.toHaveProperty("isActive");
  });
});

describe("generated org codes", () => {
  it("match the declared pattern", () => {
    const gen = orgCodeCandidates();
    for (let i = 0; i < 50; i++) {
      expect(gen.next().value).toMatch(ORG_CODE_PATTERN);
    }
  });

  it("avoid the characters people misread in the random part — no 0/O or 1/I/L", () => {
    const gen = orgCodeCandidates();
    for (let i = 0; i < 200; i++) {
      const suffix = (gen.next().value as string).replace(/^ORG-/, "");
      expect(suffix).not.toMatch(/[0O1IL]/);
    }
  });

  it("do not repeat in a small sample, so the retry loop is a rarity not a routine", () => {
    const gen = orgCodeCandidates();
    const sample = new Set<string>();
    for (let i = 0; i < 500; i++) sample.add(gen.next().value as string);
    expect(sample.size).toBe(500);
  });
});

describe("what the user typed is what gets validated", () => {
  it("normalises a lowercase PAN", () => {
    expect(parse(org({ panNumber: "abcde1234f" })).data?.panNumber).toBe("ABCDE1234F");
  });

  it("normalises a lowercase GST", () => {
    const gst = "29abcde1234f1z5";
    expect(parse(org({ gstNumber: gst })).data?.gstNumber).toBe(gst.toUpperCase());
  });

  it("keeps an empty GST and PAN optional", () => {
    expect(parse(org({ gstNumber: "", panNumber: "" })).success).toBe(true);
  });
});

describe("the form's own shape parses", () => {
  it("accepts every optional field sent as an empty string, which is what the form does", () => {
    const result = parse(
      org({
        phone: "",
        contactPerson: "",
        defaultAddress: "",
        businessName: "",
        gstNumber: "",
        panNumber: "",
        description: "",
      })
    );
    expect(result.error?.issues ?? []).toEqual([]);
  });
});

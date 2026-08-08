// The org code, GST and PAN inputs are styled `className="uppercase"`. That is CSS: it
// changes how a value looks, never what it is. So a lowercase entry displayed as
// TEST-001 and failed as "test-001", and the schema's trailing `.transform(toUpperCase)`
// could not help because the regex had already rejected it. Case is normalised first now.
import { describe, expect, it } from "vitest";
import { createOrgSchema } from "@/lib/validation/schemas/org.schema";

const org = (overrides: Record<string, unknown> = {}) => ({
  code: "TEST-001",
  name: "Test Organisation",
  email: "owner@example.com",
  defaultPincode: "560083",
  defaultCity: "Bengaluru",
  defaultState: "Karnataka",
  isActive: true,
  ...overrides,
});

const parse = (input: unknown) => createOrgSchema.safeParse(input);

describe("what the user typed is what gets validated", () => {
  it("accepts a lowercase code and stores it uppercased", () => {
    const result = parse(org({ code: "test-001" }));
    expect(result.success).toBe(true);
    expect(result.data?.code).toBe("TEST-001");
  });

  it("accepts a code with stray whitespace", () => {
    expect(parse(org({ code: "  test-001  " })).data?.code).toBe("TEST-001");
  });

  it("still rejects characters that are not letters, numbers or hyphens", () => {
    const result = parse(org({ code: "test 001" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Use letters, numbers and hyphens only");
  });

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

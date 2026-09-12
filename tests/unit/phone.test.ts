// Phone numbers (international-phone). Pinned: one stored spelling whatever was typed, the
// Indian rule kept, a schema transform safe to run twice (it runs in the browser and again
// on the server), and a backfill that touches only what was unambiguously Indian.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatPhone,
  isValidPhone,
  joinPhone,
  normalizePhone,
  splitPhone,
} from "@server/shared/phone";
import { optionalPhoneSchema, phoneSchema } from "@/lib/validation/schemas/common.schemas";
import { profileInfoFormSchema } from "@/lib/validation/schemas/profile.schemas";

describe("normalizePhone", () => {
  it("reads a bare 10-digit number as Indian — every number stored before this feature", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
  });

  it("accepts any country's number written with its code", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("+1 415 555 2671")).toBe("+14155552671");
  });

  it("drops a national trunk prefix when the country is given", () => {
    expect(normalizePhone("020 7946 0958", "GB")).toBe("+442079460958");
  });

  it("still refuses what the Indian rule refused — the reason for max metadata over min", () => {
    expect(normalizePhone("0123456789")).toBeNull();
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("stores one spelling however the number was typed", () => {
    expect(phoneSchema.parse("98765 43210")).toBe("+919876543210");
    expect(phoneSchema.parse("+91 98765 43210")).toBe("+919876543210");
  });

  it("is idempotent, because the same schema runs in the browser and again on the server", () => {
    const once = phoneSchema.parse("+44 20 7946 0958");
    expect(phoneSchema.parse(once)).toBe(once);
  });

  it("reports an invalid number as an issue, so it lands on the field", () => {
    const result = phoneSchema.safeParse("12345");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/valid phone number/);
  });

  it("optional: blank stays blank, absent stays absent, a number is normalised", () => {
    expect(optionalPhoneSchema.parse("")).toBe("");
    expect(optionalPhoneSchema.parse(undefined)).toBeUndefined();
    expect(optionalPhoneSchema.parse("9876543210")).toBe("+919876543210");
  });
});

describe("profileInfoFormSchema — the account card, converted to useServerForm", () => {
  it("allows every field blank, which the card sends as unchanged", () => {
    expect(profileInfoFormSchema.safeParse({ name: "", email: "", mobile: "" }).success).toBe(true);
  });

  it("holds a filled name to the route's own rule, so the browser refuses what the server would", () => {
    expect(profileInfoFormSchema.safeParse({ name: "<b>", email: "", mobile: "" }).success).toBe(false);
  });

  it("normalises the mobile it sends", () => {
    expect(
      profileInfoFormSchema.parse({ name: "A", email: "", mobile: "98765 43210" }).mobile
    ).toBe("+919876543210");
  });
});

describe("formatPhone", () => {
  it("shows stored and legacy numbers the same way — order snapshots keep the old spelling", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("9876543210")).toBe("+91 98765 43210");
  });

  it("shows an unparseable value as stored rather than hiding it", () => {
    expect(formatPhone("call the shop")).toBe("call the shop");
  });
});

describe("splitPhone / joinPhone — the picker and field pair", () => {
  it("splits a stored number into its country and national part", () => {
    expect(splitPhone("+442079460958")).toEqual({ country: "GB", national: "2079460958" });
  });

  it("reads a legacy bare number as Indian", () => {
    expect(splitPhone("9876543210")).toEqual({ country: "IN", national: "9876543210" });
  });

  it("joins to E.164 even while incomplete, so validation judges the country on screen", () => {
    expect(joinPhone({ country: "IN", national: "98765 43210" })).toBe("+919876543210");
    expect(joinPhone({ country: "IN", national: "987" })).toBe("+91987");
    expect(joinPhone({ country: "IN", national: "" })).toBe("");
  });
});

describe("the E.164 backfill", () => {
  const sql = readFileSync(
    "prisma/migrations/20260911120000_phone_numbers_e164/migration.sql",
    "utf8"
  );

  it("prefixes +91 only to bare 10-digit values — the one spelling the old rule allowed", () => {
    for (const [table, column] of [
      ["User", "mobile"],
      ["UserAddress", "phone"],
      ["OrgAddress", "contactPhone"],
      ["Org", "phone"],
      ["Bid", "guestPhone"],
    ]) {
      expect(sql).toMatch(
        new RegExp(`UPDATE "${table}" SET "${column}" = '\\+91' \\|\\| "${column}"\\s+WHERE "${column}" ~ '\\^\\[0-9\\]\\{10\\}\\$'`)
      );
    }
  });

  it("skips a user whose +91 spelling is already taken rather than failing the deploy", () => {
    expect(sql).toMatch(/AND NOT EXISTS \(SELECT 1 FROM "User" taken WHERE taken\."mobile" = '\+91' \|\| "User"\."mobile"\)/);
  });

  it("never rewrites an order: the address on an order is a snapshot", () => {
    expect(sql).not.toMatch(/UPDATE "Order"/);
  });

  it("reports what it left, loudly", () => {
    expect(sql).toContain("RAISE NOTICE");
  });
});

describe("a phone is contact data, not an identity key (ADR-0024)", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const sql = readFileSync(
    "prisma/migrations/20260912090000_phone_is_not_an_identity_key/migration.sql",
    "utf8"
  );

  it("leaves User.mobile unconstrained while email stays the identity key", () => {
    const user = /^model User \{$[\s\S]*?^\}$/m.exec(schema)?.[0] ?? "";
    expect(user).toMatch(/^\s*mobile\s+String\?\s*$/m);
    expect(user).toMatch(/^\s*email\s+String\?\s+@unique/m);
  });

  it("drops the unique index rather than relaxing it — nothing looks a mobile up exactly", () => {
    expect(sql).toMatch(/DROP INDEX IF EXISTS "User_mobile_key"/);
    expect(sql).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX.*"mobile"/);
  });

  it("finishes the backfill the old constraint blocked, with no collision guard left", () => {
    expect(sql).toMatch(
      /UPDATE "User" SET "mobile" = '\+91' \|\| "mobile"\s+WHERE "mobile" ~ '\^\[0-9\]\{10\}\$'/
    );
    expect(sql).not.toMatch(/NOT EXISTS/);
  });

  it("reports what it left, loudly", () => {
    expect(sql).toContain("RAISE NOTICE");
  });
});

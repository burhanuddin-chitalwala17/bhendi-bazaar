/**
 * A carrier's credentials never leave the server (shipping ADR-0002 D3, the test that ADR
 * said this rule needed). The admin console reads providers through one projection; these
 * hold that projection to a row with every credential column filled in, and hold the admin
 * service's payload type to the projection. Mutation-tested by adding `authToken: true` to
 * `PROVIDER_SUMMARY_SELECT` and by returning `authToken` from `toProviderSummary`.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { ShippingProvider } from "@prisma/client";
import {
  PROVIDER_CREDENTIAL_FIELDS,
  PROVIDER_SUMMARY_SELECT,
  toProviderSummary,
  type ShippingProviderSummary,
} from "@server/shipping/repositories/provider.repository";
import type {
  GetProviderByIdResponse,
  GetProvidersResponse,
} from "@server/shipping/services/admin.shipping.service";
import type { AdminConnectionResult } from "@server/shipping/services/connection.types";

const ROOT = resolve(__dirname, "../..");

/** Every column, typed as the row so a new column fails to compile here and gets a decision. */
const connected: ShippingProvider = {
  id: "prov_1",
  code: "shiprocket",
  name: "Shiprocket",
  description: "Aggregator",
  priority: 10,
  isConnected: true,
  connectedAt: new Date("2026-01-01T00:00:00Z"),
  connectedBy: "admin_1",
  connectionType: "email_password",
  lastAuthAt: new Date("2026-01-02T00:00:00Z"),
  authError: "SECRET_AUTH_ERROR",
  authToken: "SECRET_TOKEN",
  tokenExpiresAt: new Date("2026-02-02T00:00:00Z"),
  accountInfo: {
    id: 42,
    email: "ops@shop.example",
    password: "SECRET_ENCRYPTED_PASSWORD",
    firstName: "Ops",
    companyId: 7,
  },
  paymentOptions: ["prepaid", "cod"],
  deliveryModes: ["surface"],
  features: { tracking: true },
  logoUrl: "https://shiprocket.in/logo.png",
  websiteUrl: "https://shiprocket.in",
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

const SECRETS = ["SECRET_TOKEN", "SECRET_ENCRYPTED_PASSWORD", "SECRET_AUTH_ERROR", "2026-02-02"];

describe("the provider summary carries no credential", () => {
  it("the select names none of the credential columns", () => {
    for (const field of PROVIDER_CREDENTIAL_FIELDS) {
      expect(PROVIDER_SUMMARY_SELECT, field).not.toHaveProperty(field);
    }
  });

  it("the credential list names every column that holds one", () => {
    // The list is what the projection is held against; a column missing from it is a column
    // nothing checks.
    expect([...PROVIDER_CREDENTIAL_FIELDS].sort()).toEqual(
      ["accountInfo", "authError", "authToken", "tokenExpiresAt"].sort(),
    );
  });

  it("a connected row projects to its public face and the account email, nothing else", () => {
    const summary = toProviderSummary(connected);

    expect(summary).not.toHaveProperty("authToken");
    expect(summary).not.toHaveProperty("tokenExpiresAt");
    expect(summary).not.toHaveProperty("authError");
    expect(summary.accountInfo).toEqual({ email: "ops@shop.example" });

    const wire = JSON.stringify(summary);
    for (const secret of SECRETS) expect(wire, secret).not.toContain(secret);

    // What the console renders (src/components/shipping/providers-console) is still there.
    expect(summary).toMatchObject({
      id: "prov_1",
      code: "shiprocket",
      name: "Shiprocket",
      connectionType: "email_password",
      isConnected: true,
      logoUrl: connected.logoUrl,
      websiteUrl: connected.websiteUrl,
      lastAuthAt: connected.lastAuthAt,
      connectedBy: "admin_1",
    });
  });

  it("a disconnected row has no account at all", () => {
    const summary = toProviderSummary({ ...connected, isConnected: false, accountInfo: null });
    expect(summary).not.toHaveProperty("accountInfo");
  });

});

// The admin service's payload *type* is held to the projection. These are checked by `tsc`
// (tests are in the project), so a service returning a whole row fails the type-check even
// where no test runs it.
expectTypeOf<ShippingProviderSummary>().not.toHaveProperty("authToken");
expectTypeOf<ShippingProviderSummary>().not.toHaveProperty("tokenExpiresAt");
expectTypeOf<ShippingProviderSummary>().not.toHaveProperty("authError");
expectTypeOf<GetProvidersResponse["providers"][number]>().toEqualTypeOf<ShippingProviderSummary>();
expectTypeOf<NonNullable<GetProviderByIdResponse["provider"]>>().toEqualTypeOf<ShippingProviderSummary>();
expectTypeOf<AdminConnectionResult>().not.toHaveProperty("token");
expectTypeOf<AdminConnectionResult>().not.toHaveProperty("tokenExpiresAt");

describe("the credential read has one kind of caller", () => {
  const files = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) out.push(...files(p));
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
    return out;
  };

  it("only a carrier's own implementation reads credentials", () => {
    // A service or a route reaching for the whole row is how the row reaches a response.
    const callers = [...files(join(ROOT, "server")), ...files(join(ROOT, "src"))]
      .filter((f) => readFileSync(f, "utf8").includes("findWithCredentials("))
      .map((f) => relative(ROOT, f))
      .filter((f) => f !== "server/shipping/repositories/provider.repository.ts");

    expect(callers.length, "the scan found no caller at all").toBeGreaterThan(0);
    expect(callers.filter((f) => !f.startsWith("server/shipping/providers/"))).toEqual([]);
  });
});

// ADR-0002 rule 3: credentials never appear in a response. Two real leaks were found
// here — the provider list/detail returned the raw Prisma row (authToken in plaintext,
// accountInfo.password) with no `select`, and the connect flow's return type promised
// no `token` while the implementation just forwarded the raw provider result, which
// still carried one. TypeScript's structural typing doesn't strip fields at runtime,
// so the type alone was never a guarantee — only an explicit projection is.
import { describe, expect, it } from "vitest";
import { toSafeAccountInfo, toSafeProvider } from "@server/shipping/utils/safe-provider";
import type { ShippingProvider } from "@prisma/client";

const provider = (overrides: Partial<ShippingProvider> = {}): ShippingProvider =>
  ({
    id: "shiprocket_001",
    code: "shiprocket",
    name: "Shiprocket",
    description: null,
    priority: 1,
    isConnected: true,
    connectedAt: new Date(),
    connectedBy: "admin",
    connectionType: "email_password",
    lastAuthAt: new Date(),
    authError: "a previous failure message",
    authToken: "live-bearer-token-abc123",
    tokenExpiresAt: new Date(),
    accountInfo: { email: "ops@bhendibazaar.com", password: "iv:tag:ciphertext" },
    paymentOptions: ["prepaid"],
    deliveryModes: ["surface"],
    features: null,
    logoUrl: null,
    websiteUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ShippingProvider;

describe("toSafeProvider", () => {
  it("strips authToken and authError entirely", () => {
    const safe = toSafeProvider(provider());
    expect(safe).not.toHaveProperty("authToken");
    expect(safe).not.toHaveProperty("authError");
  });

  it("keeps accountInfo.email for the 'connected as' UI but drops the password", () => {
    const safe = toSafeProvider(provider());
    expect(safe.accountInfo).toEqual({ email: "ops@bhendibazaar.com" });
  });

  it("passes through a null accountInfo unchanged", () => {
    const safe = toSafeProvider(provider({ accountInfo: null }));
    expect(safe.accountInfo).toBeNull();
  });

  it("keeps non-sensitive connection state", () => {
    const safe = toSafeProvider(provider());
    expect(safe.isConnected).toBe(true);
    expect(safe.connectionType).toBe("email_password");
  });
});

describe("toSafeAccountInfo", () => {
  it("drops only the password key", () => {
    expect(
      toSafeAccountInfo({ email: "a@b.com", password: "secret", companyId: 1 })
    ).toEqual({ email: "a@b.com", companyId: 1 });
  });

  it("returns null for a nullish input", () => {
    expect(toSafeAccountInfo(null)).toBeNull();
    expect(toSafeAccountInfo(undefined)).toBeNull();
  });
});

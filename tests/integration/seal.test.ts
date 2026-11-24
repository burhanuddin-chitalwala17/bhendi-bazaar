/**
 * A shop's chat text sealed under its own key (meta-foundation unit 5, ADR-0085) against a real
 * database: it opens only at its own shop, table and row; two first seals for a shop make one key;
 * a key-ring rotation re-wraps keys without touching what they sealed.
 */
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
const ORG = `seal-org-${RUN}`;
const OTHER = `seal-other-${RUN}`;
const V1 = `1:${"1".repeat(64)}`;
const V2 = `2:${"2".repeat(64)}`;

describe.skipIf(!isDisposableDb)("seal (local db)", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    const { forgetUnwrappedKeys } = await import("@server/shared/seal/seal");
    forgetUnwrappedKeys();
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.orgDataKey.deleteMany({ where: { orgId: { in: [ORG, OTHER, `${ORG}-race`, `${ORG}-rot`] } } });
  });

  it("opens at its own place, and nowhere else", async () => {
    vi.stubEnv("CREDENTIAL_KEYS", V1);
    const { seal, SealError } = await import("@server/shared/seal/seal");
    const place = { orgId: ORG, table: "InboxMessage", rowId: "m1" };
    const sealed = await seal.seal(place, "Is the blue kurta in size M? 🙂");
    expect(sealed).toMatch(/^s1\.1\./);
    expect(sealed).not.toContain("kurta");
    expect(await seal.open(place, sealed)).toBe("Is the blue kurta in size M? 🙂");

    await seal.seal({ orgId: OTHER, table: "InboxMessage", rowId: "m1" }, "x");
    for (const elsewhere of [{ ...place, rowId: "m2" }, { ...place, table: "Conversation" }, { ...place, orgId: OTHER }]) {
      await expect(seal.open(elsewhere, sealed)).rejects.toBeInstanceOf(SealError);
    }
    const [head, ver, iv, tag, body] = sealed.split(".");
    const flipped = body.slice(0, -1) + (body.endsWith("A") ? "B" : "A");
    await expect(seal.open(place, [head, ver, iv, tag, flipped].join("."))).rejects.toBeInstanceOf(SealError);
    await expect(seal.open(place, "plain text")).rejects.toBeInstanceOf(SealError);
  });

  it("a place whose parts contain the separator never opens another place's value", async () => {
    vi.stubEnv("CREDENTIAL_KEYS", V1);
    const { seal, SealError } = await import("@server/shared/seal/seal");
    const sealed = await seal.seal({ orgId: ORG, table: "A|B", rowId: "c" }, "x");
    await expect(seal.open({ orgId: ORG, table: "A", rowId: "B|c" }, sealed)).rejects.toBeInstanceOf(SealError);
    await expect(seal.open({ orgId: ORG, table: "A|B", rowId: "c" }, "s1.99999999999.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AA")).rejects.toBeInstanceOf(SealError);
  });

  it("a key that no longer opens is counted and skipped; the rest are re-wrapped", async () => {
    vi.stubEnv("CREDENTIAL_KEYS", V1);
    const { seal } = await import("@server/shared/seal/seal");
    const { prisma } = await import("@server/shared/prisma");
    await prisma.orgDataKey.create({ data: { orgId: `${ORG}-0bad`, version: 1, wrappedKey: "v1:00000000000000000000000000000000:00000000000000000000000000000000:00" } });
    await seal.seal({ orgId: `${ORG}-zgood`, table: "T", rowId: "r" }, "x");
    vi.stubEnv("CREDENTIAL_KEYS", `${V1},${V2}`);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const outcome = await seal.rewrapStale();
    expect(outcome.failed).toBeGreaterThanOrEqual(1);
    expect((await prisma.orgDataKey.findUnique({ where: { orgId_version: { orgId: `${ORG}-zgood`, version: 1 } } }))?.wrappedKey).toMatch(/^v2:/);
    await prisma.orgDataKey.deleteMany({ where: { orgId: { in: [`${ORG}-0bad`, `${ORG}-zgood`] } } });
  });

  it("two first seals for a shop at once end with one key, and both open", async () => {
    vi.stubEnv("CREDENTIAL_KEYS", V1);
    const { seal } = await import("@server/shared/seal/seal");
    const { prisma } = await import("@server/shared/prisma");
    const org = `${ORG}-race`;
    const places = Array.from({ length: 6 }, (_, i) => ({ orgId: org, table: "T", rowId: `r${i}` }));
    const sealed = await Promise.all(places.map((p) => seal.seal(p, p.rowId)));
    expect(await prisma.orgDataKey.count({ where: { orgId: org } })).toBe(1);
    for (const [i, p] of places.entries()) expect(await seal.open(p, sealed[i])).toBe(p.rowId);
  });

  it("a key-ring rotation re-wraps every key under the new version; what was sealed still opens", async () => {
    vi.stubEnv("CREDENTIAL_KEYS", V1);
    const { seal, forgetUnwrappedKeys } = await import("@server/shared/seal/seal");
    const { prisma } = await import("@server/shared/prisma");
    const place = { orgId: `${ORG}-rot`, table: "InboxMessage", rowId: "rot" };
    const sealed = await seal.seal(place, "before rotation");

    vi.stubEnv("CREDENTIAL_KEYS", `${V1},${V2}`);
    expect((await seal.rewrapStale(1)).rewrapped).toBeGreaterThanOrEqual(1);
    const key = await prisma.orgDataKey.findUnique({ where: { orgId_version: { orgId: `${ORG}-rot`, version: 1 } } });
    expect(key?.wrappedKey).toMatch(/^v2:/);
    expect((await seal.rewrapStale()).rewrapped).toBe(0);

    // Only the new ring version is left: the re-wrapped key still opens the old row.
    vi.stubEnv("CREDENTIAL_KEYS", V2);
    forgetUnwrappedKeys();
    expect(await seal.open(place, sealed)).toBe("before rotation");
  });
});

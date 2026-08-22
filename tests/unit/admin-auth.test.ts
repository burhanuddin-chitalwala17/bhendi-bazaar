// `session.user.id` is a JWT claim, so it outlives the row it names. Everything that
// writes `AdminLog.adminId` trusts it as a foreign key, so this is the place the
// claim has to be turned back into a fact.
import { describe, expect, it, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
const findUnique = vi.fn();

vi.mock("next-auth", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@server/shared/prisma", () => ({
  prisma: { user: { findUnique: (args: unknown) => findUnique(args) } },
}));

const { requirePlatformAdmin, requireSession } = await import("@/lib/admin-auth");

const signedInAs = (id: string | null, platformRole: "USER" | "ADMIN" = "ADMIN") =>
  getServerSession.mockResolvedValue(id ? { user: { id, platformRole } } : null);

beforeEach(() => {
  getServerSession.mockReset();
  findUnique.mockReset();
});

describe("requireSession", () => {
  it("refuses when nobody is signed in", async () => {
    signedInAs(null);
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
  });
});

describe("requirePlatformAdmin", () => {
  it("admits an admin whose row still says so", async () => {
    signedInAs("admin-1");
    findUnique.mockResolvedValue({ platformRole: "ADMIN", isBlocked: false });

    const session = await requirePlatformAdmin();

    expect(session.user.id).toBe("admin-1");
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "admin-1" });
  });

  it("refuses a session whose user no longer exists, before anything writes", async () => {
    // The production failure: the row was gone, the token was not, and the first
    // thing to notice was a foreign key — after the category write had committed.
    signedInAs("ghost-admin");
    findUnique.mockResolvedValue(null);

    await expect(requirePlatformAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it("refuses an admin demoted since the token was minted", async () => {
    signedInAs("admin-1");
    findUnique.mockResolvedValue({ platformRole: "USER", isBlocked: false });

    await expect(requirePlatformAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a blocked admin", async () => {
    signedInAs("admin-1");
    findUnique.mockResolvedValue({ platformRole: "ADMIN", isBlocked: true });

    await expect(requirePlatformAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a non-admin claim without reaching the database", async () => {
    signedInAs("user-1", "USER");

    await expect(requirePlatformAdmin()).rejects.toMatchObject({ status: 403 });
    expect(findUnique).not.toHaveBeenCalled();
  });
});

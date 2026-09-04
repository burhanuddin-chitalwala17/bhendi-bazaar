// The account's email is the address a password reset is sent to, so anyone who can
// change it from a borrowed session owns the account. The session alone was enough
// until this gate; the password is what turns "signed in" back into "is the owner".
import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const repositoryUpdate = vi.fn();
const compare = vi.fn();

vi.mock("bcryptjs", () => ({ compare: (a: string, b: string) => compare(a, b) }));
vi.mock("@server/shared/prisma", () => ({
  prisma: { user: { findUnique: (args: unknown) => findUnique(args) } },
}));
vi.mock("@server/identity/profile.repository", () => ({
  profileRepository: {
    update: (userId: string, input: unknown) => repositoryUpdate(userId, input),
    getByUserId: vi.fn(),
    delete: vi.fn(),
  },
}));

const { profileService } = await import("@server/identity/profile.service");

const STORED = { id: "u-1", email: "old@example.com", passwordHash: "hash" };

/**
 * `validateUpdateInput` and the gate both read `user.findUnique`; the uniqueness
 * check wants a different shape than the gate, so answer by the columns selected.
 */
const accountIs = (row: { email: string | null; passwordHash: string | null }) =>
  findUnique.mockImplementation((args: { select?: Record<string, boolean> }) =>
    args.select?.passwordHash ? Promise.resolve(row) : Promise.resolve(null)
  );

beforeEach(() => {
  findUnique.mockReset();
  repositoryUpdate.mockReset();
  compare.mockReset();
  repositoryUpdate.mockResolvedValue({ user: {}, profile: {} });
  accountIs(STORED);
});

describe("changing the account email", () => {
  it("is refused outright when no password is offered", async () => {
    await expect(
      profileService.updateProfile("u-1", { email: "attacker@example.com" })
    ).rejects.toMatchObject({ status: 401 , field: "currentPassword" });

    expect(repositoryUpdate).not.toHaveBeenCalled();
  });

  it("is refused when the password is wrong — and nothing is written first", async () => {
    compare.mockResolvedValue(false);

    await expect(
      profileService.updateProfile("u-1", {
        email: "attacker@example.com",
        currentPassword: "guess",
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(repositoryUpdate).not.toHaveBeenCalled();
  });

  it("goes through when the password checks out", async () => {
    compare.mockResolvedValue(true);

    await profileService.updateProfile("u-1", {
      email: "new@example.com",
      currentPassword: "correct horse",
    });

    expect(compare).toHaveBeenCalledWith("correct horse", "hash");
    expect(repositoryUpdate).toHaveBeenCalledTimes(1);
  });

  it("never hands the password to the repository", async () => {
    compare.mockResolvedValue(true);

    await profileService.updateProfile("u-1", {
      email: "new@example.com",
      currentPassword: "correct horse",
    });

    expect(repositoryUpdate.mock.calls[0][1]).not.toHaveProperty("currentPassword");
  });

  it("refuses a Google account, which has no password to prove anything with", async () => {
    accountIs({ email: "old@example.com", passwordHash: null });

    await expect(
      profileService.updateProfile("u-1", { email: "new@example.com" })
    ).rejects.toMatchObject({ status: 403 });

    expect(repositoryUpdate).not.toHaveBeenCalled();
  });
});

describe("everything that is not a change of email", () => {
  it("lets a name through untouched", async () => {
    await profileService.updateProfile("u-1", { name: "Renamed" });

    expect(compare).not.toHaveBeenCalled();
    expect(repositoryUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not demand a password when the form echoes the current email back", async () => {
    // The edit form submits every field, so a name change carries the unchanged
    // email with it. Asking for a password there would be a prompt on every save.
    await profileService.updateProfile("u-1", {
      name: "Renamed",
      email: "old@example.com",
    });

    expect(compare).not.toHaveBeenCalled();
    expect(repositoryUpdate).toHaveBeenCalledTimes(1);
  });
});

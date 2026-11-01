/**
 * Pre-hijacked accounts (docs/GTM-READINESS.md B5; USENIX Security 2022, Sudhodanan & Paverd). An
 * attacker registers the victim's address with a password and never verifies it. When the victim
 * later signs in with Google, the accounts link, and the attacker's password must not survive.
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { isDisposableDb } from "../helpers/test-db";

const EMAIL = "prehijack-victim@example.invalid";
const VERIFIED_EMAIL = "prehijack-verified@example.invalid";

describe.skipIf(!isDisposableDb)("Google sign-in over an unverified password account (local db)", () => {
  const load = async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { authOptions } = await import("@/lib/auth-config");
    return { prisma, signIn: authOptions.callbacks!.signIn! };
  };

  const googleSignIn = (signIn: Awaited<ReturnType<typeof load>>["signIn"], email: string) =>
    signIn({
      user: { id: "x", email },
      account: { provider: "google", type: "oauth", providerAccountId: "g-1" },
      profile: { email, email_verified: true } as never,
    } as never);

  afterAll(async () => {
    const { prisma } = await load();
    await prisma.user.deleteMany({ where: { email: { in: [EMAIL, VERIFIED_EMAIL] } } });
  });

  it("removes the password nobody verified, and marks the address verified", async () => {
    const { prisma, signIn } = await load();
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.user.create({
      data: { email: EMAIL, name: "Attacker", passwordHash: "$2a$10$attackerchosenhash", isEmailVerified: false },
    });

    expect(await googleSignIn(signIn, EMAIL)).toBe(true);

    const after = await prisma.user.findUnique({
      where: { email: EMAIL },
      select: { passwordHash: true, isEmailVerified: true, emailVerified: true },
    });
    expect(after?.passwordHash).toBeNull();
    expect(after?.isEmailVerified).toBe(true);
    expect(after?.emailVerified).not.toBeNull();
  });

  it("ends the attacker's session, which was issued under the cleared password", async () => {
    const { prisma } = await load();
    const { credentialFingerprint } = await import("@/lib/credential-fingerprint");
    const attackerSession = credentialFingerprint("$2a$10$attackerchosenhash");
    const now = await prisma.user.findUnique({ where: { email: EMAIL }, select: { passwordHash: true } });
    expect(credentialFingerprint(now?.passwordHash)).not.toBe(attackerSession);
  });

  it("lets the owner set a password through forgot-password afterwards", async () => {
    const { prisma } = await load();
    const { passwordService } = await import("@server/identity/password.service");
    const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
    await prisma.verificationToken.deleteMany({ where: { identifier: `password-reset:${user?.id}` } });
    // The email itself may fail here (no provider key); the reset token is what proves it was allowed.
    await passwordService.requestPasswordReset(EMAIL).catch(() => undefined);
    const tokens = await prisma.verificationToken.count({ where: { identifier: `password-reset:${user?.id}` } });
    expect(tokens).toBe(1);
  });

  it("does not undo a verification that landed first (the write is conditional)", async () => {
    const { prisma } = await load();
    const { accountService } = await import("@server/identity/account.service");
    await prisma.user.deleteMany({ where: { email: VERIFIED_EMAIL } });
    const user = await prisma.user.create({
      data: { email: VERIFIED_EMAIL, name: "Owner", passwordHash: "$2a$10$ownerhash", isEmailVerified: true },
    });
    expect(await accountService.claimUnverifiedForOAuth(user.id)).toEqual({ passwordCleared: false });
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    expect(after?.passwordHash).toBe("$2a$10$ownerhash");
  });

  it("leaves a verified account's password alone", async () => {
    const { prisma, signIn } = await load();
    await prisma.user.deleteMany({ where: { email: VERIFIED_EMAIL } });
    await prisma.user.create({
      data: { email: VERIFIED_EMAIL, name: "Owner", passwordHash: "$2a$10$ownerhash", isEmailVerified: true },
    });

    expect(await googleSignIn(signIn, VERIFIED_EMAIL)).toBe(true);

    const after = await prisma.user.findUnique({ where: { email: VERIFIED_EMAIL }, select: { passwordHash: true } });
    expect(after?.passwordHash).toBe("$2a$10$ownerhash");
  });
});

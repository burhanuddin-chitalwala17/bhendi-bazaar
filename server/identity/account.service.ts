import { profileRepository } from "@server/identity/profile.repository";

/**
 * The account as auth and notifications see it: sign-in state, session claims, sign-up, and
 * the email-verification tokens. Their one door to the User and VerificationToken rows (ADR-0033).
 */
export class AccountService {
  findCredentialsUser(email: string) {
    return profileRepository.findByEmail(email);
  }

  findIdByEmail(email: string) {
    return profileRepository.findIdByEmail(email);
  }

  findSignInState(email: string) {
    return profileRepository.findSignInStateByEmail(email);
  }

  findSessionClaims(userId: string) {
    return profileRepository.findSessionClaims(userId);
  }

  findIsEmailVerified(userId: string) {
    return profileRepository.findIsEmailVerified(userId);
  }

  /** Re-read per admin request so a deleted, demoted or blocked admin is revoked now (ADR-0021). */
  findAdminStanding(userId: string) {
    return profileRepository.findAdminStanding(userId);
  }

  findVerificationStatus(userId: string) {
    return profileRepository.findVerificationStatus(userId);
  }

  markEmailVerified(userId: string) {
    return profileRepository.markEmailVerified(userId);
  }

  claimUnverifiedForOAuth(userId: string) {
    return profileRepository.claimUnverifiedForOAuth(userId);
  }

  createPasswordAccount(input: Parameters<typeof profileRepository.createPasswordAccount>[0]) {
    return profileRepository.createPasswordAccount(input);
  }

  createVerifiedOAuthAccount(
    input: Parameters<typeof profileRepository.createVerifiedOAuthAccount>[0],
  ) {
    return profileRepository.createVerifiedOAuthAccount(input);
  }

  /** An email-verification token is keyed by the bare user id. */
  createEmailVerificationToken(userId: string, token: string, expires: Date) {
    return profileRepository.createVerificationToken(userId, token, expires);
  }

  findVerificationToken(token: string) {
    return profileRepository.findVerificationToken(token);
  }

  deleteVerificationToken(token: string) {
    return profileRepository.deleteVerificationToken(token);
  }

  deleteEmailVerificationTokens(userId: string) {
    return profileRepository.deleteVerificationTokensFor(userId);
  }
}

export const accountService = new AccountService();

// The deployed commit, read once here so no caller names a host's variable (ADR-0037 D1).
export function deployedCommit(): string | null {
  const sha = process.env.APP_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : null;
}

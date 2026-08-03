# ADR-0002: Carrier credentials are entered through the admin console, encrypted at rest

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** A carrier account belongs to the *store operator*, not the deployment. Operators connect and disconnect carriers as commercial arrangements change, and that should not require an environment-variable change and a redeploy. Environment variables also scale badly here: a second carrier, or a second account with the same carrier, means a second set of names, and nothing associates a credential with the provider record it belongs to.
- **Decision:**
  1. Credentials are entered in the admin console and stored on the carrier's provider record.
  2. They are encrypted at rest with AES-256-GCM, a fresh random IV per message, and PBKDF2 key derivation from `ENCRYPTION_KEY` (`utils/encryption.ts`).
  3. **Credentials never appear in a response.** Reads that reach a client use an explicit `select` exposing only connection state — never `authToken`, `accountInfo`, or an auth error string.
  4. Only a provider with stored credentials can be enabled.
  5. `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` remain supported for local development only, and are never the production path.
- **Alternatives considered:**
  - *Environment variables only* — rejected for the reasons above: operator-owned data behind a developer-owned mechanism, no association with the provider record, and no path to two accounts.
  - *A dedicated secrets manager* — rejected as disproportionate. It is the better answer at scale, but it adds infrastructure and an operational dependency to store a handful of carrier logins for a single-tenant store. Revisit if the store becomes multi-tenant, where per-tenant credentials would change the calculus.
  - *Store credentials in plaintext, relying on database access control* — rejected. The database is backed up, replicated, and browsed in a GUI during development; each of those is a copy. Encryption means a leaked backup is not a leaked carrier account.
  - *Ask the operator to re-enter credentials each session* — rejected. Rate quoting happens on every checkout and must work unattended.
- **Consequences:**
  - ✅ An operator connects a carrier without a developer or a deploy.
  - ✅ Multiple carriers, and multiple accounts, are naturally supported.
  - ✅ A leaked database backup does not yield working carrier credentials.
  - ⚠️ `ENCRYPTION_KEY` becomes critical state. Losing it means re-entering every credential; rotating it requires re-encrypting stored values. Neither is currently automated.
  - ⚠️ The key needs real validation. A short or low-entropy value passes through key derivation without complaint, which makes a misconfiguration silent — the one failure mode this scheme is worst at.
  - ⚠️ Rule 3 is easy to violate by accident, because the natural Prisma read returns the whole row. It needs a test, not just a convention.

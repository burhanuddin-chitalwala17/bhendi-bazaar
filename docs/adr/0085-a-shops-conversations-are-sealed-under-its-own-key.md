# ADR-0085: A shop's conversations are sealed under its own key

- **Date:** 2026-11-23
- **Status:** Proposed

## Context

The owner promised shops that only their own team reads their chats and that no one at Bhendi
Bazaar does (social-selling Q116). The promise has to hold in the database, in admin screens, in
logs and in backups, and be checkable by a test. Bhendi Bazaar already encrypts credentials at rest
with a versioned key ring (`server/shared/crypto.ts`), but one platform-wide key means any process
holding it can read every shop's chats.

## Decision

1. **Envelope encryption with a data key per shop.** Each shop gets a random 256-bit data key,
   stored only wrapped by the current version of the platform key ring. Message bodies, previews and
   other chat text are encrypted with AES-256-GCM under the shop's data key, with the shop id, table
   and row id as additional data, so a ciphertext cannot be moved to another row or shop.
2. **Opened only for the shop.** A body is decrypted only in a request that passed the shop's
   member guard, in that shop's own automations, or under a support grant the shop issued for one
   conversation and one request, for 48 hours, recorded and shown to the shop.
3. **No staff surface can select a sealed column.** Admin read models, analytics and log calls are
   scanned by a test that fails on any sealed column; staff tools show counts, never content.
4. **Rotation by re-wrapping.** A new key-ring version re-wraps data keys without touching message
   rows; a compromised data key is replaced and its shop's rows re-encrypted by a background job.
5. **What is not sealed is named.** Names and handles stay plain because search needs them
   (inbox-core Q3); raw webhook payloads are sealed under the platform ring and kept 30 days.

## Alternatives considered

- **Postgres-level or disk encryption only.** Protects a stolen disk, not a person with database
  access; does not honour the promise.
- **End-to-end encryption to the shop's devices.** The strongest promise, rejected because automatic
  replies and product answers must read messages on the server, and a shop with several members on
  several phones would need key distribution we cannot support.
- **A hosted KMS with per-tenant keys.** The same shape with a vendor; rejected for now as a new
  dependency and per-call cost. The wrap/unwrap seam is where it would plug in.

## Consequences

- ✅ The promise is enforced by construction and by a test, not by policy alone.
- ✅ A leaked dump without the key ring reveals no chats; one shop's key reveals one shop.
- ⚠️ No full-text search of messages (already a decision, inbox-core Q3).
- ⚠️ Every read of a body pays an AES-GCM decrypt (microseconds) and a cached unwrap.
- ⚠️ Losing the key ring loses the chats; the ring is backed up as OPERATIONS.md says of
  `CREDENTIAL_KEYS`.

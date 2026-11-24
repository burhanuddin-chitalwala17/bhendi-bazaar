# Contracts — shipping

- **Verified:** 2026-11-24
- **Covers:** `server/shipping/repositories/provider.repository.ts`

The shipping shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Shipping providers (admin)
`GET /api/admin/shipping/providers` and `GET /api/admin/shipping/providers/[id]` return **`ShippingProviderSummary`** (`server/shipping/repositories/provider.repository.ts`): id, code, name, description, priority, connection state and dates, connection type, payment options, delivery modes, features, logo and website, and `accountInfo` narrowed to `{ email }`. `authToken`, `tokenExpiresAt`, `authError` and the rest of `accountInfo` never leave the server; `POST …/providers/[id]/connect` answers without the token or the password, and the audit record carries neither. `tests/unit/provider-dto.test.ts` holds the projection at type level, so `tsc` fails a widened select. Until 2026-10-05 the rows went out whole — the leak Rule 5 exists for.

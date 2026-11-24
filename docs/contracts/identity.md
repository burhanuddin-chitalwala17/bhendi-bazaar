# Contracts — identity

- **Verified:** 2026-11-24
- **Covers:** `server/identity/*.types.ts`

The identity shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Addresses
The address-book wire shape (`DeliveryAddress`) is flat and stable, but since PR-41 its `id` is the **UserAddress** relationship id (server-generated — clients no longer mint ids), `metadata` is gone (label and notes are top-level), and `fullName`, `mobile`, `state` are required. Storage is two tables: `Address` (postal fact, written only by `server/shared/address.repository.ts`) and `UserAddress` (the person's relationship). `Order.address` remains an embedded snapshot, deliberately. Since 2026-11-12 `POST /api/addresses` answers `{ success, message, address }`, `address` being the saved `DeliveryAddress` with its server id; checkout selects that one.

## Phone numbers
Since PR-102 every phone on the wire — `DeliveryAddress.mobile`, `User.mobile`, `Org.phone`, `OrgLocation.contactPhone`, a guest bidder's `guestPhone`, and `Order.address.mobile` on new orders — is **E.164** (`+919876543210`). Inbound, any valid spelling of any country's number is accepted and normalised by `phoneSchema` / `optionalPhoneSchema`; a number without `+` is read as Indian, so a pre-PR-102 caller still works. Orders placed earlier keep a bare 10-digit snapshot, and readers display through `formatPhone` (`server/shared/phone.ts`), which treats both spellings alike. The rule lives in that module and nowhere else (international-phone (`431ed6e7:docs/specs/international-phone/trd.md`)).

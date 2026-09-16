/**
 * Client-side support domain types.
 *
 * Re-exported from the domain rather than redeclared, so the admin inbox reads the same
 * shape the service returns (CONTRACTS.md's one-declaration rule).
 */
export type {
  AdminContactMessage,
  ContactMessageFilters,
  ContactMessageListResult,
  ContactMessageStatus,
} from "@server/support/contact.types";

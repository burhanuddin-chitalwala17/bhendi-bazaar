-- order-fulfilment unit 5 (D14): a shop's cancellation fee is its own ledger kind. Alone in its
-- migration because Postgres cannot use a new enum value in the transaction that added it, and the
-- next migration's partial index names it. Additive.
ALTER TYPE "LedgerEntryKind" ADD VALUE 'CANCELLATION_FEE';

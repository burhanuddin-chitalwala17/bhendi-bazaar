/**
 * Reading database constraint violations out of Prisma errors.
 *
 * The shape differs by driver: without a driver adapter Prisma sets `meta.target`
 * (or `meta.field_name` for a foreign key), but under `@prisma/adapter-pg` those are
 * undefined and the constraint appears at `meta.driverAdapterError.cause.constraint`
 * — as `fields` for a unique violation and as `index` (the constraint's name) for a
 * foreign key. Checking only one shape silently disables whatever depends on it.
 */

type AdapterCause = {
  originalMessage?: unknown;
  constraint?: { fields?: unknown; index?: unknown };
};

type PrismaishError = {
  code?: string;
  meta?: {
    target?: unknown;
    /** The model the failed operation ran against — "Product" for `product.delete`. */
    modelName?: unknown;
    field_name?: unknown;
    column?: unknown;
    driverAdapterError?: { cause?: AdapterCause };
  };
};

const cause = (e: PrismaishError): AdapterCause | undefined =>
  e.meta?.driverAdapterError?.cause;

const asStrings = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map(String) : typeof raw === "string" && raw ? [raw] : [];

/**
 * `Product_orgId_sku_key` -> `["orgId", "sku"]`.
 *
 * Prisma names a unique index `<Model>_<field>…_key`, so the columns are recoverable
 * from the name alone. The two hand-written partial indexes — `ProductMedia_one_thumbnail_per_product`
 * and `BiddingEvent_one_open_per_product` — deliberately do not match, and fall through
 * to the unattributed case below, which is right: neither is a field a form can highlight.
 */
function parseUniqueConstraintName(name: string): string[] {
  // Some engine versions append " (index)" to the constraint name.
  const match = /^([A-Za-z][A-Za-z0-9]*)_(.+)_key$/.exec(name.replace(/\s*\(index\)\s*$/, ""));
  return match ? match[2].split("_") : [];
}

/** Columns named by a unique-constraint violation, or null if it isn't one. */
export function uniqueViolationFields(error: unknown): string[] | null {
  const e = error as PrismaishError;
  if (e?.code !== "P2002") return null;

  const constraint = cause(e)?.constraint;

  const fields = constraint?.fields;
  if (Array.isArray(fields) && fields.length) return fields.map(String);

  // Prisma 7.10 reports the constraint's NAME here where 7.1 reported its columns, and
  // the two are indistinguishable to a caller asking "was it the sku?". Reading only
  // `fields` did not fail — it returned the unattributed `[]` below, so every
  // `isUniqueViolation(error, field)` quietly answered false and a duplicate SKU
  // surfaced as a raw Prisma error instead of "that SKU belongs to an archived product".
  if (typeof constraint?.index === "string") {
    const parsed = parseUniqueConstraintName(constraint.index);
    if (parsed.length) return parsed;
  }

  const target = e.meta?.target;
  if (Array.isArray(target) && target.length) return target.map(String);
  if (typeof target === "string" && target) return [target];

  // A P2002 whose columns we cannot read is still a uniqueness failure; report it
  // as one with no attribution rather than as an unknown error.
  return [];
}

export function isUniqueViolation(error: unknown, field: string): boolean {
  const fields = uniqueViolationFields(error);
  return fields !== null && fields.includes(field);
}

/** True for Prisma's "record not found" on an update/delete. */
export function isNotFoundViolation(error: unknown): boolean {
  return (error as PrismaishError)?.code === "P2025";
}

export type ConstraintFailure =
  /** A value pointing at a parent row that is not there. The caller picked wrong. */
  | { kind: "foreignKey"; fields: string[] }
  /**
   * The same error code from the other direction: rows elsewhere still reference the
   * row being deleted, and an `onDelete: Restrict` refused. Nothing the caller typed
   * is wrong, so no field is attributed.
   */
  | { kind: "restricted"; fields: []; referencingTable: string | null }
  | { kind: "tooLong"; fields: string[] }
  | { kind: "nullConstraint"; fields: string[] };

/** `OrderItem_productId_fkey` -> table `OrderItem`, column `productId`. */
function parseForeignKeyName(name: string) {
  // Some engine versions append " (index)" to the constraint name.
  const clean = name.replace(/\s*\(index\)\s*$/, "");
  const match = /^([A-Za-z][A-Za-z0-9]*)_(.+)_fkey$/.exec(clean);
  return match ? { table: match[1], column: match[2] } : null;
}

/**
 * Which side of the foreign key failed. Postgres says so in its own wording, which is
 * the only signal that does not depend on guessing from names; the constraint's table
 * is the fallback, since a violation on *another* table's key can only mean rows there
 * still point at this one.
 */
function isReferencedFromElsewhere(
  e: PrismaishError,
  parsed: { table: string } | null
): boolean {
  const message = cause(e)?.originalMessage;
  if (typeof message === "string") {
    if (message.startsWith("update or delete on table")) return true;
    if (message.startsWith("insert or update on table")) return false;
  }
  const model = e.meta?.modelName;
  return typeof model === "string" && !!parsed && parsed.table !== model;
}

/**
 * Constraint failures other than uniqueness that still name a column, so a form can
 * highlight it: a foreign key pointing at a deleted row, a value too long, a missing
 * required value. Uniqueness is handled separately by `uniqueViolationFields`.
 */
export function constraintFields(error: unknown): ConstraintFailure | null {
  const e = error as PrismaishError;
  const code = e?.code;
  if (code !== "P2003" && code !== "P2000" && code !== "P2011") return null;

  const meta = e.meta as Record<string, unknown> | undefined;
  // Prisma names the column differently per code: `field_name` for a foreign key,
  // `column` for a length overflow, `target` for a null violation.
  const engineFields = asStrings(meta?.field_name ?? meta?.column ?? meta?.target);
  const adapterConstraint = cause(e)?.constraint;
  const adapterIndex =
    typeof adapterConstraint?.index === "string" ? adapterConstraint.index : null;
  const adapterFields = asStrings(adapterConstraint?.fields);

  if (code === "P2003") {
    // A foreign key reports its constraint name; recover the column from it so the
    // error can be attributed to a field.
    const parsed = parseForeignKeyName(adapterIndex ?? engineFields[0] ?? "");
    if (isReferencedFromElsewhere(e, parsed)) {
      return { kind: "restricted", fields: [], referencingTable: parsed?.table ?? null };
    }
    return { kind: "foreignKey", fields: parsed ? [parsed.column] : engineFields };
  }

  const fields = engineFields.length ? engineFields : adapterFields;
  return code === "P2000"
    ? { kind: "tooLong", fields }
    : { kind: "nullConstraint", fields };
}

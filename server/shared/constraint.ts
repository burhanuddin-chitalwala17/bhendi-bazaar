/**
 * Reading database constraint violations out of Prisma errors.
 *
 * The shape differs by driver: without a driver adapter Prisma sets `meta.target`,
 * but under `@prisma/adapter-pg` that is undefined and the columns appear at
 * `meta.driverAdapterError.cause.constraint.fields`. Checking only one shape
 * silently disables whatever depends on it.
 */

type PrismaishError = {
  code?: string;
  meta?: {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
  };
};

/** Columns named by a unique-constraint violation, or null if it isn't one. */
export function uniqueViolationFields(error: unknown): string[] | null {
  const e = error as PrismaishError;
  if (e?.code !== "P2002") return null;

  const fields = e.meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields) && fields.length) return fields.map(String);

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

/**
 * Other constraint failures that still name a column, so a form can highlight it:
 * a foreign key pointing at a deleted row, a value too long, a missing required
 * value. Uniqueness is handled separately by `uniqueViolationFields`.
 */
export function constraintFields(
  error: unknown
): { kind: "foreignKey" | "tooLong" | "nullConstraint"; fields: string[] } | null {
  const e = error as PrismaishError;
  const kind =
    e?.code === "P2003" ? "foreignKey" as const
    : e?.code === "P2000" ? "tooLong" as const
    : e?.code === "P2011" ? "nullConstraint" as const
    : null;
  if (!kind) return null;

  const meta = e.meta as Record<string, unknown> | undefined;
  // Prisma names the column differently per code: `field_name` for a foreign key,
  // `column` for a length overflow, `target` for a null violation.
  const raw = meta?.field_name ?? meta?.column ?? meta?.target;
  const fields = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string" && raw
      ? [raw]
      : [];

  // A foreign key reports the constraint name (`Product_categoryId_fkey`); recover
  // the column from it so the error can be attributed to a field.
  const cleaned = fields.map((f) => {
    const m = /^[A-Za-z]+_(.+)_fkey$/.exec(f);
    return m ? m[1] : f;
  });

  return { kind, fields: cleaned };
}

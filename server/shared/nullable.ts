/**
 * Normalise a blank optional value to `null` before it reaches the database.
 *
 * Matters for any column that is both nullable and unique: Postgres permits many
 * `NULL`s but only one `''`, so storing an empty string from a blank form field
 * makes the *second* such row a unique-constraint violation. Currently applies to
 * `Product.sku`, `User.email`, and `User.mobile`.
 */
export function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

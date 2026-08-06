/**
 * Normalise a blank optional value to `null` before it reaches the database.
 *
 * Matters most for any column that is both nullable and unique: Postgres permits many
 * `NULL`s but only one `''`, so storing an empty string from a blank form field
 * makes the *second* such row a unique-constraint violation — `Product.sku`,
 * `User.email`, `User.mobile`. Also applied to plain nullable columns whose readers
 * treat absence as "fall back to a default", so that absence has one spelling.
 */
export function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

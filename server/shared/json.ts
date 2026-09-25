import type { Prisma } from "@prisma/client";

/**
 * A typed value bound for a Prisma `Json` column. The JSON round-trip is what Prisma does to
 * the value anyway, and it strips `undefined` members exactly as serialisation will — so the
 * type says `InputJsonValue` because the value now genuinely is one, rather than a cast
 * asserting it. Lives apart from the client so a script can use it without opening a pool.
 */
export function toJsonColumn<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  uniqueViolationFields,
  isNotFoundViolation,
  constraintFields,
} from "@server/shared/constraint";
import { isDomainError } from "@server/shared/domain-error";
import type { ApiErrorBody, ApiErrorDetail } from "@/lib/api-error";

/**
 * Convert anything thrown in a route handler into the standard envelope
 * (docs/CONTRACTS.md), so clients rely on one shape and field attribution survives.
 * Five branches; only the last discards its message.
 */

/** Field name -> label, for messages an admin or customer will read. */
const FIELD_LABELS: Record<string, string> = {
  sku: "SKU",
  slug: "URL slug",
  email: "email address",
  mobile: "mobile number",
  code: "code",
  gstNumber: "GST number",
  categoryId: "category",
  sellerId: "seller",
};

const label = (field: string) => FIELD_LABELS[field] ?? field;

export function toErrorResponse(
  error: unknown,
  fallbackMessage = "Something went wrong"
): NextResponse {
  // 1. Invalid input shape — every issue attributed to its field.
  if (error instanceof z.ZodError) {
    const details: ApiErrorDetail[] = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return json({ error: "Please correct the highlighted fields", details }, 400);
  }

  // 2. Domain code opted in to being shown.
  if (isDomainError(error)) {
    return json(
      {
        error: error.message,
        ...(error.field
          ? { details: [{ path: error.field, message: error.message }] }
          : {}),
      },
      error.status
    );
  }

  // 3. Uniqueness — knowable only at the database, so no client validation replaces it.
  const conflicting = uniqueViolationFields(error);
  if (conflicting !== null) {
    if (!conflicting.length) return json({ error: "That value is already in use" }, 409);
    return json(
      {
        error:
          conflicting.length === 1
            ? `This ${label(conflicting[0])} is already in use`
            : "Some values are already in use",
        details: conflicting.map((f) => ({
          path: f,
          message: `This ${label(f)} is already in use`,
        })),
      },
      409
    );
  }

  // 4. Other constraint failures that still name a column: a foreign key pointing at
  //    something deleted, a value too long, a missing required value.
  const constraint = constraintFields(error);
  if (constraint) {
    const perField = (f: string) =>
      constraint.kind === "foreignKey"
        ? `That ${label(f)} no longer exists — pick another`
        : constraint.kind === "tooLong"
          ? `This ${label(f)} is too long`
          : `This ${label(f)} is required`;
    const summary =
      constraint.fields.length === 1
        ? perField(constraint.fields[0])
        : constraint.kind === "foreignKey"
          ? "One of the selected records no longer exists"
          : "Some values were rejected";
    return json(
      {
        error: summary,
        ...(constraint.fields.length
          ? { details: constraint.fields.map((f) => ({ path: f, message: perField(f) })) }
          : {}),
      },
      409
    );
  }

  // 5. Prisma could not find the row it was told to change.
  if (isNotFoundViolation(error)) {
    return json({ error: "That record no longer exists" }, 404);
  }

  // 6. Unknown: an internal fault. Logged in full, reported generically — the only
  //    branch that discards its message, and the safe default for anything that has
  //    not opted in via DomainError.
  console.error("Unhandled route error:", error);
  return json({ error: fallbackMessage }, 500);
}

function json(body: ApiErrorBody, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

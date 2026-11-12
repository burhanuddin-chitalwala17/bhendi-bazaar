import { NextResponse } from "next/server";
import { z } from "zod";
import {
  uniqueViolationFields,
  isNotFoundViolation,
  constraintFields,
} from "@server/shared/constraint";
import { FeatureLockedError, isDomainError } from "@server/shared/domain-error";
import type { ApiErrorBody, ApiErrorDetail } from "@/lib/api-error";
import { RateLimitedError } from "@/lib/rate-limit/refusal";
import { ERROR_RESPONSE_COPY, FIELD_LABEL_COPY, REFERENCED_BY_COPY } from "@/lib/lib-copy";

/**
 * Convert anything thrown in a route handler into the standard envelope
 * (docs/CONTRACTS.md), so clients rely on one shape and field attribution survives.
 * Five branches; only the last discards its message.
 */

/** Field name -> label, for messages an admin or customer will read. */
const FIELD_LABELS = FIELD_LABEL_COPY;

const label = (field: string) => FIELD_LABELS[field] ?? field;

/**
 * Table name -> what its rows are, for a delete refused by a Restrict foreign key.
 * Only the tables that actually hold such a key need an entry; anything else falls
 * back to the generic wording.
 */
const REFERENCED_BY_LABELS = REFERENCED_BY_COPY;

export function toErrorResponse(
  error: unknown,
  fallbackMessage: string = ERROR_RESPONSE_COPY.somethingWentWrong
): NextResponse {
  // 1. Invalid input shape — every issue attributed to its field.
  if (error instanceof z.ZodError) {
    const details: ApiErrorDetail[] = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return json({ error: ERROR_RESPONSE_COPY.correctHighlighted, details }, 400);
  }

  // 2. Domain code opted in to being shown. A rate-limit refusal also says when to retry.
  if (isDomainError(error)) {
    const response = json(
      {
        error: error.message,
        // A lock names its feature, so the client opens the right sheet (feature-access D4).
        ...(error instanceof FeatureLockedError
          ? { details: [{ path: "feature", message: error.feature }] }
          : error.field
            ? { details: [{ path: error.field, message: error.message }] }
            : {}),
      },
      error.status
    );
    if (error instanceof RateLimitedError) {
      for (const [name, value] of Object.entries(error.headers())) response.headers.set(name, value);
    }
    return response;
  }

  // 3. Uniqueness — knowable only at the database, so no client validation replaces it.
  const conflicting = uniqueViolationFields(error);
  if (conflicting !== null) {
    if (!conflicting.length) return json({ error: ERROR_RESPONSE_COPY.valueInUse }, 409);
    return json(
      {
        error:
          conflicting.length === 1
            ? ERROR_RESPONSE_COPY.fieldInUse(label(conflicting[0]))
            : ERROR_RESPONSE_COPY.valuesInUse,
        details: conflicting.map((f) => ({
          path: f,
          message: ERROR_RESPONSE_COPY.fieldInUse(label(f)),
        })),
      },
      409
    );
  }

  // 4. Other constraint failures that still name a column: a foreign key pointing at
  //    something deleted, a value too long, a missing required value.
  const constraint = constraintFields(error);
  if (constraint) {
    // 4a. The same foreign key from the other direction: an `onDelete: Restrict`
    //     refused to orphan rows that still point here (ADR-0020). Nothing the caller
    //     typed is wrong, so nothing is attributed to a field and "pick another" would
    //     be nonsense. Domain code that can name the blocker should throw a
    //     DomainError first; this is the honest fallback when it has not.
    if (constraint.kind === "restricted") {
      const referrer = REFERENCED_BY_LABELS[constraint.referencingTable ?? ""];
      return json(
        {
          error: referrer
            ? ERROR_RESPONSE_COPY.cannotDeleteReferredBy(referrer)
            : ERROR_RESPONSE_COPY.cannotDeleteReferred,
        },
        409
      );
    }
    const perField = (f: string) =>
      constraint.kind === "foreignKey"
        ? ERROR_RESPONSE_COPY.fieldGone(label(f))
        : constraint.kind === "tooLong"
          ? ERROR_RESPONSE_COPY.fieldTooLong(label(f))
          : ERROR_RESPONSE_COPY.fieldRequired(label(f));
    const summary =
      constraint.fields.length === 1
        ? perField(constraint.fields[0])
        : constraint.kind === "foreignKey"
          ? ERROR_RESPONSE_COPY.recordsGone
          : ERROR_RESPONSE_COPY.valuesRejected;
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
    return json({ error: ERROR_RESPONSE_COPY.recordGone }, 404);
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

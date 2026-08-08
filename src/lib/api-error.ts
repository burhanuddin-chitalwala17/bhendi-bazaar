/**
 * The error envelope every route handler returns and every client reads.
 *
 * One shape, two sources: a Zod failure and a database constraint violation both
 * arrive as `details`, so a form does not need to know which produced it. This file
 * is deliberately free of `next/server` imports so client components can use it.
 *
 * Wire shape is documented in docs/CONTRACTS.md.
 */

export interface ApiErrorDetail {
  /** Field path, dot-joined for nested fields. Matches the form field name. */
  path: string;
  message: string;
}

export interface ApiErrorBody {
  /** Human-readable summary. Always present. */
  error: string;
  /** Field-attributed problems, when the failure can be blamed on specific input. */
  details?: ApiErrorDetail[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: ApiErrorDetail[];

  constructor(message: string, status: number, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Turn a failed `fetch` Response into an ApiError, preserving field details.
 *
 * Exists because every client wrapper used to reach into the body by hand — and one
 * of them read `error.message` where the server sends `error`, so the real reason
 * was replaced by a generic fallback with nothing to indicate the loss.
 */
export async function readApiError(response: Response): Promise<ApiError> {
  const fallback = `Request failed (${response.status})`;
  let body: Partial<ApiErrorBody> & { message?: string } = {};

  try {
    body = await response.json();
  } catch {
    // Non-JSON body (a proxy error page, an empty 500). The status is all we have.
    return new ApiError(fallback, response.status);
  }

  const details = Array.isArray(body.details) ? body.details : [];
  // `message` is accepted as a fallback because one legacy handler sends it.
  const message = body.error || body.message || details[0]?.message || fallback;
  return new ApiError(message, response.status, details);
}

type SetFieldError = (
  path: string,
  error: { type: string; message: string },
  options?: { shouldFocus: boolean }
) => void;

/**
 * Route field-attributed errors onto form fields via react-hook-form's setError.
 *
 * Returns whatever could not be placed, so the caller can still surface it. A detail
 * silently dropped because its path is not a form field is the failure this whole
 * mechanism exists to prevent.
 */
export function applyServerErrors(
  details: ApiErrorDetail[],
  setError: SetFieldError,
  knownFields?: readonly string[]
): { applied: ApiErrorDetail[]; unapplied: ApiErrorDetail[] } {
  const applied: ApiErrorDetail[] = [];
  const unapplied: ApiErrorDetail[] = [];

  details.forEach((detail, index) => {
    const placeable =
      detail.path && (!knownFields || knownFields.includes(detail.path));
    if (!placeable) {
      unapplied.push(detail);
      return;
    }
    setError(
      detail.path,
      { type: "server", message: detail.message },
      { shouldFocus: index === 0 }
    );
    applied.push(detail);
  });

  return { applied, unapplied };
}

/**
 * An expected failure whose message is safe to show the user.
 *
 * Throwing this is how domain code opts in to being surfaced. Anything else that
 * reaches a route handler is treated as an internal fault: logged, and reported
 * generically. That default matters — a raw Prisma message can name columns and
 * occasionally credentials.
 *
 * `field` attributes the failure to a form input, so the form highlights it. Use it
 * whenever a user could fix the problem by changing one value.
 */
export class DomainError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(
    message: string,
    options: { status?: number; field?: string; cause?: unknown } = {}
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "DomainError";
    this.status = options.status ?? 400;
    this.field = options.field;
  }
}

/** Nothing matched. 404. */
export class NotFoundError extends DomainError {
  constructor(message: string, options: { field?: string; cause?: unknown } = {}) {
    super(message, { ...options, status: 404 });
    this.name = "NotFoundError";
  }
}

/** The request conflicts with existing state — duplicates, exhausted stock. 409. */
export class ConflictError extends DomainError {
  constructor(message: string, options: { field?: string; cause?: unknown } = {}) {
    super(message, { ...options, status: 409 });
    this.name = "ConflictError";
  }
}

/** Nobody is signed in. 401 — distinct from 403, which means signed in but not allowed. */
export class UnauthorizedError extends DomainError {
  constructor(message = "You need to be signed in to do that") {
    super(message, { status: 401 });
    this.name = "UnauthorizedError";
  }
}

/** The caller may not do this. 403. */
export class ForbiddenError extends DomainError {
  constructor(message = "You do not have permission to do that") {
    super(message, { status: 403 });
    this.name = "ForbiddenError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

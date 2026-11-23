import { SOCIAL_ERROR, type SocialError } from "../../social/types";

/** Meta's failures in our words: one class carrying our code (meta-foundation D2, R9, Q6). */
export class MetaError extends Error {
  // Private so `console.error(error)` and `util.inspect` never print Meta's text (R9).
  readonly #reasonText: string | null;

  constructor(
    readonly code: SocialError,
    readonly step: string,
    readonly metaCode: number | null = null,
    readonly metaSubcode: number | null = null,
    /** Seconds until the limit resets, when known (rate limits only). */
    readonly retryAfterSeconds: number | null = null,
    reasonText: string | null = null,
  ) {
    super(`Meta ${code} (${step}${metaCode !== null ? `, code ${metaCode}` : ""})`);
    this.name = "MetaError";
    this.#reasonText = reasonText;
  }

  /** Meta's own sentence, ≤300 characters, kept only for a refusal ux.md shows the shop. Never log it. */
  get reasonText(): string | null {
    return this.#reasonText;
  }
}

/** A read answered in a shape we do not understand: our code or Meta's API changed. Not retryable. */
export class MetaShapeError extends Error {
  constructor(readonly step: string) {
    super(`Meta answered ${step} in an unexpected shape`);
    this.name = "MetaShapeError";
  }
}

/** Expired or invalidated access (190's subcodes 463 and 467 included). */
const AUTH_CODES = new Set([102, 190]);
/** Call-count and spend limits: app, user, business use case, Instagram, WhatsApp throughput and pair limits. */
const RATE_CODES = new Set([4, 17, 32, 613, 80002, 80006, 80007, 80014, 130429, 131048, 131056]);
const WINDOW_CODES = new Set([131047]);
/** Instagram's "outside the allowed window" subcodes. */
const WINDOW_SUBCODES = new Set([2018278, 2534022]);
const UNDELIVERABLE_CODES = new Set([131026, 131051, 131052, 551]);
/** Meta says the service was unavailable, so nothing happened: safe to retry. */
const NOT_DONE_CODES = new Set([2, 131016]);
/** Meta's generic "unknown error": on a call that changes something we cannot know whether it did (ADR-0080). */
const UNKNOWN_CODES = new Set([1, 131000]);

const MAX_REASON = 300;

export interface MetaErrorBody {
  code?: number;
  error_subcode?: number;
  message?: string;
}

/** Which of our codes a Meta answer means; `mayHaveTakenEffect` marks a send or publish (ADR-0080). */
export function classifyMetaError(
  status: number,
  body: MetaErrorBody | null,
  step: string,
  mayHaveTakenEffect: boolean,
  retryAfterSeconds: number | null,
): MetaError {
  const code = typeof body?.code === "number" ? body.code : null;
  const subcode = typeof body?.error_subcode === "number" ? body.error_subcode : null;
  const reason = typeof body?.message === "string" ? body.message.slice(0, MAX_REASON) : null;
  const make = (ours: SocialError, retry: number | null = null, text: string | null = null) =>
    new MetaError(ours, step, code, subcode, retry, text);
  const unknown = () => make(mayHaveTakenEffect ? SOCIAL_ERROR.UNCERTAIN : SOCIAL_ERROR.UNAVAILABLE);

  if ((code !== null && AUTH_CODES.has(code)) || status === 401) return make(SOCIAL_ERROR.AUTH);
  if ((code !== null && RATE_CODES.has(code)) || status === 429) return make(SOCIAL_ERROR.RATE_LIMITED, retryAfterSeconds ?? 60);
  if ((code !== null && WINDOW_CODES.has(code)) || (subcode !== null && WINDOW_SUBCODES.has(subcode))) {
    return make(SOCIAL_ERROR.WINDOW_CLOSED);
  }
  if (code !== null && UNDELIVERABLE_CODES.has(code)) return make(SOCIAL_ERROR.UNDELIVERABLE);
  if (code === 10 || (code !== null && code >= 200 && code <= 299) || status === 403) return make(SOCIAL_ERROR.PERMISSION);
  if (code !== null && NOT_DONE_CODES.has(code)) return make(SOCIAL_ERROR.UNAVAILABLE);
  if (code !== null && UNKNOWN_CODES.has(code)) return unknown();
  if (status >= 500) return unknown();
  return make(SOCIAL_ERROR.REFUSED, null, reason);
}

/** Failures that mean the request never reached Meta. */
const NOT_SENT_CAUSES = new Set(["ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"]);

/** A `fetch` that threw: after sending, a send may have taken effect; before connecting, nothing did. */
export function classifyNetworkFailure(error: unknown, step: string, mayHaveTakenEffect: boolean): MetaError {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  const notSent = typeof cause === "string" && NOT_SENT_CAUSES.has(cause);
  return new MetaError(mayHaveTakenEffect && !notSent ? SOCIAL_ERROR.UNCERTAIN : SOCIAL_ERROR.UNAVAILABLE, step);
}

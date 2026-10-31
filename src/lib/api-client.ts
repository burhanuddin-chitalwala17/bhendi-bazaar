import { ApiError, readApiError } from "@/lib/api-error";

/** `body` takes a plain value (sent as JSON) or a `FormData`/`Blob` (sent as it is). */
export type ApiRequestInit = Omit<RequestInit, "body"> & { body?: unknown; timeoutMs?: number };

/** Long enough for a slow 3G upload of a form, short enough that a hung request ends in words. */
export const DEFAULT_TIMEOUT_MS = 30_000;

export const OFFLINE_MESSAGE = "You seem to be offline. Check your connection and try again.";
export const TIMEOUT_MESSAGE = "This is taking too long. Check your connection and try again.";

function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  // AbortSignal.any is missing on older Safari; the caller's own signal then wins.
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal;
}

/**
 * The one place the browser calls our API (ADR-0048). Every `*ApiClient` sends through
 * this, so a failure is always an `ApiError` carrying the envelope's field details, and an
 * empty reply is `undefined` rather than a JSON parse error.
 */
export async function apiRequest<T = void>(url: string, init: ApiRequestInit = {}): Promise<T> {
  const { body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
  const raw = body instanceof FormData || body instanceof Blob;
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      signal: withTimeout(signal, timeoutMs),
      headers: body === undefined || raw ? headers : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch (error) {
    // The caller cancelled: theirs to handle, not a failure to show.
    if (signal?.aborted) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") throw new ApiError(TIMEOUT_MESSAGE, 0);
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new ApiError(OFFLINE_MESSAGE, 0);
    // fetch rejects only when nothing came back at all: the network, not the server.
    if (error instanceof TypeError) throw new ApiError(OFFLINE_MESSAGE, 0);
    throw error;
  }

  if (!response.ok) throw await readApiError(response);
  if (!response.headers.get("content-type")?.includes("application/json")) return undefined as T;
  return (await response.json()) as T;
}

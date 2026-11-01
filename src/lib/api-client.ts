import { readApiError } from "@/lib/api-error";

/** `body` takes a plain value (sent as JSON) or a `FormData`/`Blob` (sent as it is). */
export type ApiRequestInit = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * The one place the browser calls our API (ADR-0048). Every `*ApiClient` sends through
 * this, so a failure is always an `ApiError` carrying the envelope's field details, and an
 * empty reply is `undefined` rather than a JSON parse error.
 */
export async function apiRequest<T = void>(url: string, init: ApiRequestInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const raw = body instanceof FormData || body instanceof Blob;
  const response = await fetch(url, {
    ...rest,
    headers: body === undefined || raw ? headers : { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
  });

  if (!response.ok) throw await readApiError(response);
  if (!response.headers.get("content-type")?.includes("application/json")) return undefined as T;
  return (await response.json()) as T;
}

/** A file our API makes, as bytes — a download whose failure still arrives as an `ApiError`. */
export async function apiDownload(url: string, init?: Pick<RequestInit, "method" | "body">): Promise<Blob> {
  const response = await fetch(url, init);
  if (!response.ok) throw await readApiError(response);
  return await response.blob();
}

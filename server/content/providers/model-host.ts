import { DomainError } from "@server/shared/domain-error";

/**
 * Where the hosted models live and what buys them, declared once for every capability that uses
 * them (image-enhancement trd D3). Two capabilities now read the same key and the same endpoint —
 * cutting a product out and painting a setting around it — and a second spelling of either is a
 * second place to forget when the account moves. Named for what they hold rather than for who
 * sells them ([ADR-0037](../../../docs/adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).
 */
const DEFAULT_ENDPOINT = "https://fal.run";

/** A key is the whole of the configuration: with one these work anywhere, without one nowhere. */
export function modelApiKey(): string | undefined {
  return process.env.IMAGE_MODEL_API_KEY?.trim() || undefined;
}

/** The host, with any trailing slash taken off so a path never doubles it. */
export function modelEndpoint(): string {
  return (process.env.IMAGE_MODEL_ENDPOINT?.trim() || DEFAULT_ENDPOINT).replace(/\/+$/, "");
}

/**
 * A hosted model answers with a link to the picture it made, not with the bytes. One more fetch,
 * bounded the same way as the first, and anything that is not a picture is the caller's failure
 * message rather than the vendor's words.
 */
export async function fetchPicture(url: string, timeoutMs: number, failure: string): Promise<Buffer> {
  const picture = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).catch((cause: unknown) => {
    throw new DomainError(failure, { cause });
  });
  if (!picture.ok) throw new DomainError(failure, { cause: picture.status });
  return Buffer.from(await picture.arrayBuffer());
}

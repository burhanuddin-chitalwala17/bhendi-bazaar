/**
 * A person Meta asked us to forget (meta-foundation R7, D7). Each domain holding what a platform
 * user wrote or is (inbox, audience) registers a forgetter when the worker starts; channels runs
 * them all for a request and imports none.
 */

export interface Forgetter {
  name: string;
  /** Deletes everything this domain holds for the platform's user id, in every shop. Idempotent. */
  forget(platform: "instagram" | "whatsapp", platformUserId: string): Promise<void>;
}

const forgetters: Forgetter[] = [];

export function registerForgetter(forgetter: Forgetter): void {
  if (forgetters.some((existing) => existing.name === forgetter.name)) throw new Error(`Forgetter "${forgetter.name}" is registered twice`);
  forgetters.push(forgetter);
}

export function allForgetters(): readonly Forgetter[] {
  return forgetters;
}

/** Test seam. */
export function resetForgetters(): void {
  forgetters.length = 0;
}

import type { EnhancementProvider } from "@server/content/enhancement.types";
import type { SceneAspect } from "@server/content/scene-presets";

/**
 * Painting a setting around a product — the second capability, behind its own interface
 * (image-enhancement trd D3). There is exactly one painter today and no free route to a second:
 * a scene is a generation, and nothing we already pay for generates. The seam exists anyway,
 * because which service paints is the platform's business (spec R8) and a second one arriving
 * should be a file beside this one rather than a rewrite of the tool that calls it.
 *
 * What comes back is a **backdrop**, never the result: the tool pastes our own cut-out over it and
 * checks the product pixel for pixel before anything is proposed (spec R4, trd D4).
 */
export interface ScenePaintInput {
  /** The product already cut out, as PNG with alpha — what the setting is painted around. */
  cutout: Buffer;
  /** The preset's own words, never an org member's (spec R11). */
  prompt: string;
  aspect: SceneAspect;
}

export interface ScenePainter {
  /** What the ledger records as having performed the paint (spec R9). */
  key: EnhancementProvider;
  /** Whether this service is configured at all — asked before it is chosen, never after. */
  isAvailable(): boolean;
  /** The painted scene's bytes. Any picture format sharp can read; the tool re-encodes. */
  paint(input: ScenePaintInput): Promise<Buffer>;
}

/**
 * A painted scene is a generation rather than a transform, and takes longer than a cut-out does.
 * Bounded all the same: a worker waiting on a service that has stopped answering holds a job slot
 * for as long as the socket stays open.
 */
export const SCENE_TIMEOUT_MS = 60_000;

/**
 * What the org member is told when the service will not answer. One sentence whichever service it
 * was and whatever it said — the choice is the platform's (spec R8), and a vendor's error text is
 * nobody's idea of a shop-owner's language.
 */
export const SCENE_FAILED_MESSAGE = "The scene could not be painted just now. Try again in a moment.";

/**
 * The one exception, and it earns being one: an unpaid account is not a moment to wait out, and
 * "try again" is advice that cannot work. It still names no vendor — only the thing the platform
 * owner has to do about it.
 */
export const SCENE_NO_CREDIT_MESSAGE = "The picture service is out of credit. Ask the platform owner to top it up.";

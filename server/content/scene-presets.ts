/**
 * The settings a product can be placed in, declared once (image-enhancement spec R11, trd D2).
 *
 * The list is the platform owner's and an org picks from it — it never types a description. A
 * free prompt is a way to ask for a scene we have not seen, on an account we pay for, and the one
 * thing this feature promises is that nothing about the product changes; a fixed list is what
 * makes that promise checkable. This module is loaded in the browser as well, so it holds copy and
 * plain data and nothing else.
 *
 * `aspect` belongs to the setting rather than to the member's choice: a drape falls and a shelf
 * stacks, so both read tall, while a table and a counter are what a marketplace listing wants
 * square. The member picks a picture, not a geometry.
 */

export const SCENE_ASPECT = {
  /** What a marketplace listing takes. */
  SQUARE: "square",
  /** 4:5, what an Instagram post takes. */
  PORTRAIT: "portrait",
} as const;
export type SceneAspect = (typeof SCENE_ASPECT)[keyof typeof SCENE_ASPECT];

/** Width over height, so one number shapes the canvas whichever way round it is. */
export const SCENE_ASPECT_RATIO: Record<SceneAspect, number> = {
  [SCENE_ASPECT.SQUARE]: 1,
  [SCENE_ASPECT.PORTRAIT]: 4 / 5,
};

/** What the tile says under the label, so a member knows the shape before spending a run. */
export const SCENE_ASPECT_COPY: Record<SceneAspect, string> = {
  [SCENE_ASPECT.SQUARE]: "Square, for a marketplace",
  [SCENE_ASPECT.PORTRAIT]: "Tall, for Instagram",
};

export interface ScenePreset {
  /** What the request carries and the ledger records. */
  key: string;
  /** What the org member reads on the tile. */
  label: string;
  /** What the service is told. Never seen by a member, and never written by one. */
  prompt: string;
  aspect: SceneAspect;
}

/**
 * The five the owner approved. Keyed by the key so there is one spelling of it, and the prompts
 * describe the setting alone — the product is pasted back over whatever comes home (trd D4), so
 * anything the prompt said about it would be describing a thing it cannot affect.
 */
export const SCENE_PRESET = {
  "wooden-table": {
    key: "wooden-table",
    label: "Wooden table by a window",
    prompt:
      "a warm wooden table top beside a window, soft daylight falling from one side, a plain " +
      "wall softly out of focus behind, gentle natural shadows",
    aspect: SCENE_ASPECT.SQUARE,
  },
  "marble-counter": {
    key: "marble-counter",
    label: "Marble counter",
    prompt:
      "a pale marble counter top, bright even light, a clean neutral background softly out of " +
      "focus, a faint reflection on the stone",
    aspect: SCENE_ASPECT.SQUARE,
  },
  "shop-shelf": {
    key: "shop-shelf",
    label: "On a shop shelf",
    prompt:
      "a tidy retail shelf in a small shop, warm indoor lighting, blurred shelves and stock " +
      "receding behind, shallow depth of field",
    aspect: SCENE_ASPECT.PORTRAIT,
  },
  "fabric-drape": {
    key: "fabric-drape",
    label: "On a fabric drape",
    prompt:
      "softly draped neutral linen fabric with gentle folds, diffused studio light, quiet " +
      "shadows in the folds, no pattern",
    aspect: SCENE_ASPECT.PORTRAIT,
  },
  "studio-colour": {
    key: "studio-colour",
    label: "Plain studio colour",
    prompt:
      "a seamless plain pastel studio backdrop, even diffused light, a soft contact shadow " +
      "beneath, nothing else in the frame",
    aspect: SCENE_ASPECT.SQUARE,
  },
} as const satisfies Record<string, ScenePreset>;

export type ScenePresetKey = keyof typeof SCENE_PRESET;

/** The list as the sheet shows it, in the order the owner put them in. */
export const SCENE_PRESETS = Object.values(SCENE_PRESET);

/** The keys the boundary validates against, so an unknown setting never reaches a row (spec R11). */
export const SCENE_PRESET_KEYS = Object.keys(SCENE_PRESET) as ScenePresetKey[];

/** The preset a stored row names, or null where the list no longer has one by that name. */
export function scenePresetFor(key: string | null | undefined): ScenePreset | null {
  if (!key) return null;
  return (SCENE_PRESET as Record<string, ScenePreset>)[key] ?? null;
}

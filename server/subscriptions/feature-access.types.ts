/**
 * The paid features a shop may hold, named once (subscriptions/feature-access D2). Declared in code
 * rather than stored, as `CHANNEL` is: a feature needs enforcement code before it can mean anything.
 */
export const FEATURE = {
  CHANNELS: "channels",
  STOREFRONT: "storefront",
  IMAGE_ENHANCEMENT: "image_enhancement",
  /** Instagram and WhatsApp: posts, the inbox, auto-replies, campaigns (social-selling Q8, A-D21). */
  SOCIAL_SELLING: "social_selling",
} as const;

export type Feature = (typeof FEATURE)[keyof typeof FEATURE];

export const FEATURES: readonly Feature[] = Object.values(FEATURE);

export function isFeature(value: string): value is Feature {
  return (FEATURES as readonly string[]).includes(value);
}

/** What a page hands its leaves to decide how each paid action is drawn (CONTRACTS.md). */
export interface FeatureAccessDTO {
  channels: boolean;
  storefront: boolean;
  imageEnhancement: boolean;
  socialSelling: boolean;
}

/** One switch as the admin's Plan tab reads it: absent means never switched, which is off. */
export interface FeatureSwitchDTO {
  feature: Feature;
  enabled: boolean;
  changedAt: string | null;
  changedBy: { name: string | null; email: string | null } | null;
}

export interface OrgPlanDTO {
  /** The home brand holds every feature and has no switches (Q13). */
  homeBrand: boolean;
  switches: FeatureSwitchDTO[];
}

export const FEATURE_LABEL: Record<Feature, string> = {
  [FEATURE.CHANNELS]: "Channels",
  [FEATURE.STOREFRONT]: "Storefront",
  [FEATURE.IMAGE_ENHANCEMENT]: "Image enhancement",
  [FEATURE.SOCIAL_SELLING]: "Social selling",
};

export const ALL_ON: FeatureAccessDTO = { channels: true, storefront: true, imageEnhancement: true, socialSelling: true };

const ACCESS_KEY: Record<Feature, keyof FeatureAccessDTO> = {
  [FEATURE.CHANNELS]: "channels",
  [FEATURE.STOREFRONT]: "storefront",
  [FEATURE.IMAGE_ENHANCEMENT]: "imageEnhancement",
  [FEATURE.SOCIAL_SELLING]: "socialSelling",
};

/** Whether these answers hold a feature: the one reading, shared by the server and the browser (D4). */
export function holds(access: FeatureAccessDTO, feature: Feature): boolean {
  return access[ACCESS_KEY[feature]];
}

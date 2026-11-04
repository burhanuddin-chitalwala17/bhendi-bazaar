import type { BannerActionVariant } from "@prisma/client";
import type { ImageSlotWriteInput } from "@server/catalog/image-slot-write";

export type BannerActionInput = {
  label: string;
  href: string;
  variant: BannerActionVariant;
};

/** What a write path accepts. `order` is absent on purpose — it is server-owned. */
export type BannerInput = {
  title: string | null;
  eyebrow: string | null;
  description: string | null;
  /** Both pictures and their framing; resolved to columns by `resolveImageSlot` (image-slots D7). */
  image: ImageSlotWriteInput | null;
  imageAlt: string | null;
  isActive: boolean;
  actions: BannerActionInput[];
};

export type AdminBanner = {
  id: string;
  title: string | null;
  eyebrow: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAssetId: string | null;
  phoneImageUrl: string | null;
  /** Parsed on read by `readImageFraming`, never cast (ADR-0051). */
  imageFraming: unknown;
  imageAlt: string | null;
  order: number;
  isActive: boolean;
  actions: (BannerActionInput & { id: string })[];
};

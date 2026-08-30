import type { BannerActionVariant } from "@prisma/client";

export type BannerActionInput = {
  label: string;
  href: string;
  variant: BannerActionVariant;
};

/** What a write path accepts. `order` is absent on purpose — it is server-owned. */
export type BannerInput = {
  title: string;
  eyebrow: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  isActive: boolean;
  actions: BannerActionInput[];
};

export type AdminBanner = {
  id: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  order: number;
  isActive: boolean;
  actions: (BannerActionInput & { id: string })[];
};

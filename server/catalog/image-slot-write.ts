/**
 * The one write path for a slot's pictures (image-slots trd D7), used by the home banners, a shop's
 * banners and its storefront photos. Everything the field decided is decided again here (R7): the
 * picture is a ready one in the owner's library, a crop lies inside it at the slot's shape, a fill
 * is a colour. The columns it returns are whitelisted by name; nothing from the input is spread.
 */

import { Prisma } from "@prisma/client";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { DomainError } from "@server/shared/domain-error";
import { type ImageFraming, type StoredSideFraming } from "@server/catalog/image-framing";
import {
  CENTRE,
  FORM_FACTOR,
  IMAGE_FIT,
  IMAGE_SLOTS,
  frameProblem,
  positionOfFrame,
  toFractions,
  toPixels,
  type FocusPoint,
  type FormFactor,
  type FractionRect,
  type ImageFit,
  type ImageSlotKey,
} from "@server/catalog/image-slots";

/** The parsed wire shape (`imageSlotInputSchema`), restated so server/ never imports src/. */
export interface ImageSlotWriteSide {
  url: string;
  fit: ImageFit;
  crop: FractionRect | null;
  fill: string | null;
}

export interface ImageSlotWriteInput {
  desktop: ImageSlotWriteSide | null;
  phone: ImageSlotWriteSide | null;
  phoneFocus: FocusPoint;
}

export interface ImageSlotColumns {
  imageUrl: string | null;
  imageAssetId: string | null;
  phoneImageUrl: string | null;
  phoneImageAssetId: string | null;
  imageFraming: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

/** What the row holds now: an unchanged picture saved before the media library may stay (spec R8). */
export interface CurrentImage {
  imageUrl: string | null;
  imageAssetId: string | null;
}

const NAMED: Record<FormFactor, string> = { [FORM_FACTOR.DESKTOP]: "The desktop picture", [FORM_FACTOR.PHONE]: "The phone picture" };

export async function resolveImageSlot(
  slot: ImageSlotKey,
  ownerOrgId: string | null,
  input: ImageSlotWriteInput | null,
  current: CurrentImage | null,
  field = "image",
): Promise<ImageSlotColumns> {
  if (!input || (!input.desktop && !input.phone)) {
    return { imageUrl: null, imageAssetId: null, phoneImageUrl: null, phoneImageAssetId: null, imageFraming: Prisma.JsonNull };
  }
  const refuse = (formFactor: FormFactor, message: string) =>
    new DomainError(`${NAMED[formFactor]}: ${message}`, { status: 400, field });

  const resolveSide = async (formFactor: FormFactor, side: ImageSlotWriteSide) => {
    const shape = IMAGE_SLOTS[slot][formFactor];
    const asset = await mediaAssetRepository.findReadyImageByRef(ownerOrgId, side.url);
    if (!asset || !asset.width || !asset.height) {
      // Saved before the media library, and not changed now: kept, framed as it always rendered.
      if (formFactor === FORM_FACTOR.DESKTOP && current?.imageUrl === side.url) {
        const framing: StoredSideFraming = {
          fit: side.fit,
          crop: null,
          sourceWidth: null,
          sourceHeight: null,
          fill: side.fit === IMAGE_FIT.CONTAIN ? side.fill : null,
          position: CENTRE,
        };
        return { url: side.url, assetId: current.imageAssetId, framing };
      }
      throw refuse(formFactor, "upload it here first. Only pictures in your own library can be used.");
    }

    let crop = null;
    if (side.fit === IMAGE_FIT.CROP && side.crop) {
      crop = toPixels(side.crop, asset.width, asset.height);
      const problem = frameProblem(crop, asset.width, asset.height, shape);
      if (problem) throw refuse(formFactor, problem);
    }
    if (side.fit === IMAGE_FIT.CONTAIN && !side.fill) throw refuse(formFactor, "Fit it in needs a colour for the edges.");
    const framing: StoredSideFraming = {
      fit: side.fit,
      crop,
      sourceWidth: asset.width,
      sourceHeight: asset.height,
      fill: side.fit === IMAGE_FIT.CONTAIN ? side.fill : null,
      position: crop ? positionOfFrame(toFractions(crop, asset.width, asset.height)) : CENTRE,
    };
    return { url: asset.ref, assetId: asset.id, framing };
  };

  const desktop = input.desktop ? await resolveSide(FORM_FACTOR.DESKTOP, input.desktop) : null;
  const phone = input.phone ? await resolveSide(FORM_FACTOR.PHONE, input.phone) : null;
  const framing: ImageFraming = {
    desktop: desktop?.framing ?? null,
    phone: phone?.framing ?? null,
    phoneFocus: input.phoneFocus,
  };
  return {
    imageUrl: desktop?.url ?? null,
    imageAssetId: desktop?.assetId ?? null,
    phoneImageUrl: phone?.url ?? null,
    phoneImageAssetId: phone?.assetId ?? null,
    imageFraming: framing,
  };
}

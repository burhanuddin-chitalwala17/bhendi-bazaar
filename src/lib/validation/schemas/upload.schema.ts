import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@server/catalog/image-paths";
import { SHA256_HEX } from "@server/shared/hash";
import { CROP_ROTATIONS } from "@/lib/image/crop-transform";

/** Nothing we store is larger on a side; a claimed pixel beyond it is a lie, not a picture. */
const MAX_EDGE_PX = 20_000;

/**
 * How a crop was made from its source (media-library trd D6a): a quarter turn, then a rectangle
 * in whole pixels of the turned picture. The arithmetic lives in `src/lib/image/crop-transform.ts`.
 */
export const cropTransformSchema = z.object({
  rotation: z.literal(CROP_ROTATIONS),
  crop: z.object({
    x: z.number().int().nonnegative().max(MAX_EDGE_PX),
    y: z.number().int().nonnegative().max(MAX_EDGE_PX),
    width: z.number().int().positive().max(MAX_EDGE_PX),
    height: z.number().int().positive().max(MAX_EDGE_PX),
  }),
});

/** The upload is a derived image: the asset it was made from, and how. */
export const derivedFromSchema = z.object({
  assetId: z.string().trim().min(1).max(64),
  transform: cropTransformSchema,
});

export type DerivedFromInput = z.infer<typeof derivedFromSchema>;

/**
 * What a browser must send to be granted one upload (ADR-0028).
 *
 * The presigned URL that comes back *is* the permission, so everything the signature
 * will bind has to be established here first — the path it may write, the type, and the
 * exact byte count. A field validated loosely is a field the browser gets to choose
 * (Invariant 4).
 */
export const presignUploadSchema = z.object({
  /**
   * Where in the bucket. Prefix containment is the caller's job, since admin and org
   * routes own different folders; what is rejected here is the shape that defeats a
   * prefix test — a traversal segment, an absolute path, a protocol-relative one.
   */
  pathname: z
    .string()
    .trim()
    .min(1, "A pathname is required")
    .max(1024)
    .refine((value) => !value.startsWith("/"), "Pathname must be relative")
    .refine(
      (value) => !value.split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
      "Pathname may not contain empty, . or .. segments"
    ),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, { message: "Not an allowed image type" }),
  /** Signed into the URL, so it is a limit rather than a claim. */
  size: z
    .number()
    .int("Size must be a whole number of bytes")
    .positive("Size must be greater than zero")
    .max(MAX_IMAGE_BYTES, `Each image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller`),
  /** SHA-256 hex of the bytes, when the browser could compute it — how a repeat upload is recognised. */
  contentHash: z.string().regex(SHA256_HEX, "Not a SHA-256 hex digest").optional(),
  /** These bytes were made from an image the caller owns — a crop — and the record says so (trd D6a). */
  derivedFrom: derivedFromSchema.optional(),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

/** What the browser sends once the bytes have landed (media-library trd D2). Dimensions are optional: the server reads the object when the browser could not. */
export const confirmUploadSchema = z.object({
  assetId: z.string().trim().min(1).max(64),
  width: z.number().int().positive().max(MAX_EDGE_PX).optional(),
  height: z.number().int().positive().max(MAX_EDGE_PX).optional(),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

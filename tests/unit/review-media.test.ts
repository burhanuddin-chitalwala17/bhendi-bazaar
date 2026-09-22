/**
 * What a review may carry, and what it may not (review-media R1, R5, R6, R12).
 *
 * The cap and the host test are the whole of this feature's exposure: reviewing needs no
 * purchase and reviews publish immediately, so the fields here are the only thing between
 * an arbitrary account and a picture on an org's product page.
 *
 * A photograph on somebody else's host is the case worth pinning. It would make the
 * product page a hotlink to content we can neither moderate nor delete — R10 and R12
 * defeated by one field — which is why the service tests it even though the shared schema
 * cannot (trd.md D8).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.R2_PUBLIC_BASE_URL ??= "https://images.example.com";
const own = (name: string) => `${process.env.R2_PUBLIC_BASE_URL}/reviews/u1/${name}`;

const repository = {
  create: vi.fn(),
  updateOwn: vi.fn(),
  deleteOwn: vi.fn(),
  imageRefsFor: vi.fn(),
  getReviewById: vi.fn(),
  deleteReview: vi.fn(),
};
const deleted: string[] = [];

vi.mock("@server/catalog/review.repository", () => ({ reviewRepository: repository }));
vi.mock("@server/catalog/product.repository", () => ({
  productsRepository: { isOnSale: async () => true },
}));
vi.mock("@server/checkout/order.service", () => ({
  orderService: { hasPurchased: async () => new Set<string>() },
}));
vi.mock("@server/identity/profile.service", () => ({
  profileService: { getProfile: async () => ({ user: { name: "Fatima" } }) },
}));
vi.mock("@server/shared/audit/audit.service", () => ({
  recordAdminAction: vi.fn(),
  recordAdminActionIn: vi.fn(),
}));
vi.mock("@server/catalog/review-rating", () => ({
  loadRatingContext: async () => ({ byProduct: new Map() }),
  ratingFor: () => ({ average: 0, count: 0, histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }),
  STAR_VALUES: [1, 2, 3, 4, 5],
}));
vi.mock("@server/catalog/object-store", async () => {
  const actual = await vi.importActual<typeof import("@server/catalog/object-store")>(
    "@server/catalog/object-store",
  );
  return {
    ...actual,
    deleteObject: async (url: string) => {
      deleted.push(url);
    },
  };
});

const { reviewService } = await import("@server/catalog/review.service");
const { reviewSubmissionSchema } = await import(
  "@/lib/validation/schemas/review.schema"
);
const { MAX_REVIEW_PHOTOS } = await import("@server/catalog/media");
const { DomainError } = await import("@server/shared/domain-error");

beforeEach(() => {
  vi.clearAllMocks();
  deleted.length = 0;
  repository.create.mockResolvedValue({
    id: "rev-1",
    userId: "u1",
    userName: "Fatima",
    rating: 5,
    title: null,
    comment: null,
    isVerified: false,
    createdAt: new Date("2026-09-20T00:00:00Z"),
    media: [],
  });
  repository.imageRefsFor.mockResolvedValue([]);
  repository.updateOwn.mockResolvedValue(1);
  repository.deleteOwn.mockResolvedValue(1);
});

describe("the submission schema", () => {
  it("accepts up to the cap and refuses one more", () => {
    const photos = (count: number) =>
      Array.from({ length: count }, (_, index) => own(`p${index}.webp`));
    expect(
      reviewSubmissionSchema.safeParse({ rating: 5, photos: photos(MAX_REVIEW_PHOTOS) })
        .success,
    ).toBe(true);
    expect(
      reviewSubmissionSchema.safeParse({
        rating: 5,
        photos: photos(MAX_REVIEW_PHOTOS + 1),
      }).success,
    ).toBe(false);
  });

  it("treats no photos as an empty set rather than undefined", () => {
    expect(reviewSubmissionSchema.parse({ rating: 5 }).photos).toEqual([]);
  });

  it("stores a pasted video link as the bare id, whichever shape it was", () => {
    const shapes = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "dQw4w9WgXcQ",
    ];
    for (const shape of shapes) {
      expect(reviewSubmissionSchema.parse({ rating: 5, video: shape }).video).toBe(
        "dQw4w9WgXcQ",
      );
    }
  });

  it("refuses something that is not a video link", () => {
    expect(
      reviewSubmissionSchema.safeParse({ rating: 5, video: "https://example.com/clip.mp4" })
        .success,
    ).toBe(false);
  });

  it("has no field for a video file, on any plan (ADR-0017)", () => {
    const parsed = reviewSubmissionSchema.parse({
      rating: 5,
      videoFile: "data:video/mp4;base64,AAAA",
    });
    expect(parsed).not.toHaveProperty("videoFile");
  });

  it("accepts photos and video identically on a create and an edit", () => {
    const fields = Object.keys(
      reviewSubmissionSchema.parse({
        rating: 5,
        title: "t",
        comment: "c",
        photos: [own("a.webp")],
        video: null,
      }),
    ).sort();
    expect(fields).toEqual(["comment", "photos", "rating", "title", "video"]);
  });
});

describe("what the service does with media", () => {
  it("stores photographs as IMAGE rows and the video as a YOUTUBE row", async () => {
    await reviewService.create("u1", "p1", {
      rating: 5,
      photos: [own("a.webp"), own("b.webp")],
      video: "dQw4w9WgXcQ",
    });
    expect(repository.create.mock.calls[0][0].media).toEqual([
      { kind: "IMAGE", ref: own("a.webp") },
      { kind: "IMAGE", ref: own("b.webp") },
      { kind: "YOUTUBE", ref: "dQw4w9WgXcQ" },
    ]);
  });

  it("refuses a photograph on a host that is not ours", async () => {
    await expect(
      reviewService.create("u1", "p1", {
        rating: 5,
        photos: ["https://not-ours.example.com/anything.jpg"],
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("refuses more photographs than the cap even if the schema was bypassed", async () => {
    await expect(
      reviewService.create("u1", "p1", {
        rating: 5,
        photos: Array.from({ length: MAX_REVIEW_PHOTOS + 1 }, (_, i) => own(`${i}.webp`)),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("deletes the files when the author deletes the review (R12)", async () => {
    repository.imageRefsFor.mockResolvedValue([own("a.webp"), own("b.webp")]);
    await reviewService.remove("rev-1", "u1");
    expect(deleted).toEqual([own("a.webp"), own("b.webp")]);
  });

  it("keeps the files when the delete was not theirs", async () => {
    repository.imageRefsFor.mockResolvedValue([own("a.webp")]);
    repository.deleteOwn.mockResolvedValue(0);
    await expect(reviewService.remove("rev-1", "stranger")).rejects.toThrow();
    expect(deleted).toEqual([]);
  });

  it("deletes only the files an edit dropped", async () => {
    repository.imageRefsFor.mockResolvedValue([own("keep.webp"), own("drop.webp")]);
    await reviewService.edit("rev-1", "u1", {
      rating: 4,
      photos: [own("keep.webp")],
    });
    expect(deleted).toEqual([own("drop.webp")]);
  });

  it("deletes the files when the platform deletes the review", async () => {
    repository.getReviewById.mockResolvedValue({
      id: "rev-1",
      productName: "Rida",
      userName: "Fatima",
      rating: 5,
    });
    repository.imageRefsFor.mockResolvedValue([own("a.webp")]);
    await reviewService.deleteReview("rev-1", "admin-1");
    expect(deleted).toEqual([own("a.webp")]);
  });
});

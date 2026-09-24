/**
 * Home banners: the schema the route parses, the row-to-props mapping the storefront
 * reads through, and the arithmetic behind the "bring a bigger image" message.
 *
 * These are the parts that fail quietly. A banner with a broken destination still
 * renders; an `order` accepted from a body still returns 200.
 */
import { describe, expect, it } from "vitest";
import {
  bannerFormSchema,
  reorderBannersSchema,
} from "@/lib/validation/schemas/banner.schema";
import { describeBannerImageProblem } from "@/components/banners/banner-image-check";
import { isCompleteReorder, nextBannerOrder } from "@server/catalog/banner.order";
import { readFileSync } from "node:fs";
import { toHeroBanner } from "@/data-access-layer/banners.dal";
import { isRenderableImageUrl } from "@server/catalog/image-paths";
import { BANNER_IMAGE } from "@/lib/config";
import type { AdminBanner } from "@server/catalog/banner.types";

const minimal = { title: "Eid picks" };

describe("bannerFormSchema", () => {
  it("needs only a title", () => {
    const parsed = bannerFormSchema.parse(minimal);
    expect(parsed.title).toBe("Eid picks");
    expect(parsed.eyebrow).toBeNull();
    expect(parsed.imageUrl).toBeNull();
    expect(parsed.isActive).toBe(true);
    expect(parsed.actions).toEqual([]);
  });

  it("turns an untouched optional input into null, not an empty string", () => {
    const parsed = bannerFormSchema.parse({ ...minimal, eyebrow: "  ", description: "" });
    expect(parsed.eyebrow).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("rejects a title that is too short", () => {
    expect(bannerFormSchema.safeParse({ title: "a" }).success).toBe(false);
  });

  // The headline is optional like every other word on the banner. Blank and absent
  // must land on the same value: the renderer drops the scrim on null, and an ""
  // slipping through would keep it over artwork that needs none.
  it("accepts a banner with no title, blank or absent", () => {
    expect(bannerFormSchema.parse({}).title).toBeNull();
    expect(bannerFormSchema.parse({ title: "   " }).title).toBeNull();
    expect(bannerFormSchema.parse({ title: null }).title).toBeNull();
  });

  // `order` is server-owned. Accepting it — even optionally — is how the field a form
  // forgot to send silently resets the display order.
  it("never carries an order through from the body", () => {
    const parsed = bannerFormSchema.parse({ ...minimal, order: 99 });
    expect(parsed).not.toHaveProperty("order");
  });

  describe("actions", () => {
    const action = { label: "Shop", href: "/category/abayas", variant: "PRIMARY" as const };

    it("accepts up to two", () => {
      expect(
        bannerFormSchema.safeParse({ ...minimal, actions: [action, action] }).success
      ).toBe(true);
    });

    it("refuses a third — a phone wraps it onto its own line", () => {
      expect(
        bannerFormSchema.safeParse({ ...minimal, actions: [action, action, action] }).success
      ).toBe(false);
    });

    // The hero is the storefront's most prominent surface, so a destination there must
    // not send a shopper off the shop. That rule now has two halves: the schema asks
    // only whether this is link-shaped, because an admin pastes what is in the address
    // bar; whose site it names is settled in `bannerService`, which stores the path and
    // refuses a foreign origin (`toInternalPath`).
    it("refuses a destination that is not link-shaped at all", () => {
      for (const href of ["example.com", "abayas", ""]) {
        expect(
          bannerFormSchema.safeParse({ ...minimal, actions: [{ ...action, href }] }).success,
          href
        ).toBe(false);
      }
    });

    it("accepts the full URL an admin pastes, and a bare path", () => {
      for (const href of ["https://bhendi-bazaar.com/category/abayas", "/category/abayas"]) {
        expect(
          bannerFormSchema.safeParse({ ...minimal, actions: [{ ...action, href }] }).success,
          href
        ).toBe(true);
      }
    });

    it("leaves off-site destinations to the service, which stores only paths", async () => {
      const { toInternalPath } = await import("@server/shared/internal-href");
      // What the schema now lets through, and what stops it one layer down.
      expect(toInternalPath("https://example.com/category/abayas")).toBeNull();
    });

    it("defaults the style to the filled treatment", () => {
      const parsed = bannerFormSchema.parse({
        ...minimal,
        actions: [{ label: "Shop", href: "/x" }],
      });
      expect(parsed.actions[0].variant).toBe("PRIMARY");
    });
  });
});

describe("reorderBannersSchema", () => {
  it("takes a list of ids", () => {
    expect(reorderBannersSchema.parse({ ids: ["a", "b"] }).ids).toEqual(["a", "b"]);
  });

  it("refuses an empty list", () => {
    expect(reorderBannersSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});

describe("toHeroBanner", () => {
  const row: AdminBanner = {
    id: "b1",
    title: "Eid picks",
    eyebrow: null,
    description: null,
    imageUrl: null,
    imageAlt: null,
    order: 0,
    isActive: true,
    actions: [],
  };

  it("drops null columns rather than passing empty strings down", () => {
    const banner = toHeroBanner(row);
    expect(banner.eyebrow).toBeUndefined();
    expect(banner.description).toBeUndefined();
    expect(banner.image).toBeUndefined();
  });

  it("carries an image only when there is a url", () => {
    expect(toHeroBanner({ ...row, imageUrl: "https://x/y.jpg", imageAlt: "Abayas" }).image)
      .toEqual({ src: "https://x/y.jpg", alt: "Abayas" });
  });

  it("survives an image with no description", () => {
    expect(toHeroBanner({ ...row, imageUrl: "https://x/y.jpg" }).image?.alt).toBe("");
  });

  it("maps the action variant onto the component's vocabulary", () => {
    const banner = toHeroBanner({
      ...row,
      actions: [
        { id: "a1", label: "Shop", href: "/a", variant: "PRIMARY" },
        { id: "a2", label: "Browse", href: "/b", variant: "SECONDARY" },
      ],
    });
    expect(banner.actions?.map((a) => a.variant)).toEqual(["primary", "secondary"]);
  });
});

describe("describeBannerImageProblem", () => {
  it("passes the stated size", () => {
    expect(describeBannerImageProblem(BANNER_IMAGE.width, BANNER_IMAGE.height)).toBeNull();
  });

  it("passes a larger image at the same shape", () => {
    expect(describeBannerImageProblem(3200, 1280)).toBeNull();
  });

  it("names the width it got when the image is too small", () => {
    const problem = describeBannerImageProblem(800, 320);
    expect(problem).toContain("800px");
    expect(problem).toContain(`${BANNER_IMAGE.width}px`);
  });

  // A square hero would be cropped to a letterbox, losing most of the picture.
  it("refuses a shape too far from 5:2", () => {
    expect(describeBannerImageProblem(2000, 2000)).toContain("2000×2000");
  });

  it("allows a little slack around 5:2", () => {
    expect(describeBannerImageProblem(1600, 610)).toBeNull(); // 2.62:1
    expect(describeBannerImageProblem(1600, 680)).toBeNull(); // 2.35:1
  });

  it("treats an unreadable image as a problem, not a pass", () => {
    expect(describeBannerImageProblem(0, 0)).not.toBeNull();
  });
});

// The TRD named these three and the first version of this suite skipped them; the
// reorder rule and the empty hero are both the kind that fail silently.
describe("nextBannerOrder", () => {
  it("puts the first banner at 0", () => {
    expect(nextBannerOrder(null)).toBe(0);
    expect(nextBannerOrder(undefined)).toBe(0);
  });

  it("appends after the last one, so a create never lands mid-list", () => {
    expect(nextBannerOrder(0)).toBe(1);
    expect(nextBannerOrder(7)).toBe(8);
  });
});

describe("isCompleteReorder", () => {
  it("accepts a list naming every banner exactly once", () => {
    expect(isCompleteReorder(["a", "b", "c"], 3)).toBe(true);
  });

  // A short list leaves the unnamed rows holding a position that now collides.
  it("refuses a list that misses a banner", () => {
    expect(isCompleteReorder(["a", "b"], 3)).toBe(false);
  });

  it("refuses a list with a repeat, which would put two banners in one place", () => {
    expect(isCompleteReorder(["a", "a", "b"], 3)).toBe(false);
  });

  it("refuses a list longer than the set", () => {
    expect(isCompleteReorder(["a", "b", "c", "d"], 3)).toBe(false);
  });
});

// The banner's shape is stated in three places — the upload check, the CSS token, and
// the artwork guidance. They are one fact and drift silently if nothing compares them.
describe("banner aspect ratio", () => {
  it("derives from the stated dimensions rather than restating them", () => {
    expect(BANNER_IMAGE.ratio).toBe(BANNER_IMAGE.width / BANNER_IMAGE.height);
  });

  it("matches --aspect-banner-source in globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const declared = css.match(/--aspect-banner-source:\s*(\d+)\s*\/\s*(\d+)/);
    expect(declared, "--aspect-banner-source is not defined").not.toBeNull();
    expect(Number(declared![1]) / Number(declared![2])).toBe(BANNER_IMAGE.ratio);
  });
});

/**
 * A row can still hold a URL on the retired Vercel Blob store (ADR-0028). The bytes
 * answer 403 and the host is deliberately absent from `next.config.ts`
 * `remotePatterns` — and `next/image` does not degrade on an unconfigured host, it
 * **throws** and unmounts the page. One leftover row blanked `/admin/banners`, which
 * is where the documented remedy (re-upload) has to happen, and the storefront
 * homepage with it. A dead URL must read as "no image".
 */
describe("a URL we cannot render", () => {
  const DEAD =
    "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/banners/x.jpeg";

  it("refuses the retired store and accepts what we serve now", () => {
    expect(isRenderableImageUrl(DEAD)).toBe(false);
    expect(isRenderableImageUrl("https://cdn.bhendi-bazaar.com/a.webp")).toBe(
      true,
    );
    expect(isRenderableImageUrl("/local.png")).toBe(true);
    expect(isRenderableImageUrl(null)).toBe(false);
    expect(isRenderableImageUrl("not a url")).toBe(false);
  });

  it("drops the image from the hero rather than handing it to next/image", () => {
    const row: AdminBanner = {
      id: "b1",
      title: "Royal silhouettes",
      eyebrow: null,
      description: null,
      imageUrl: DEAD,
      imageAlt: null,
      order: 0,
      isActive: true,
      actions: [],
    };
    expect(toHeroBanner(row).image).toBeUndefined();
  });
});

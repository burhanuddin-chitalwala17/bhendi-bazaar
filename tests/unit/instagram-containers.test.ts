/**
 * A destination as the containers Instagram's content API makes (instagram-publishing TRD D1, D5):
 * one image, a carousel of 2–10, a reel or a story, each with only the fields Instagram takes on it.
 */
import { describe, expect, it } from "vitest";
import {
  IG_REFUSAL,
  IG_SHAPE,
  buildContainers,
  instagramShape,
  withChildren,
  type IgMedia,
} from "@server/channels/instagram/containers";

const img = (n: number): IgMedia => ({ kind: "IMAGE", url: `https://cdn.test/p${n}.jpg` });
const vid: IgMedia = { kind: "VIDEO", url: "https://cdn.test/clip-1080p.mp4" };
const noFields = { userTags: [], collaborators: [], locationId: null };

describe("the shape a destination takes", () => {
  it("reads a feed post's shape from its media, never from a stored field", () => {
    expect(instagramShape("IG_FEED", [img(1)])).toBe(IG_SHAPE.IMAGE);
    expect(instagramShape("IG_FEED", [img(1), img(2)])).toBe(IG_SHAPE.CAROUSEL);
    expect(instagramShape("IG_FEED", Array.from({ length: 10 }, (_, i) => img(i)))).toBe(IG_SHAPE.CAROUSEL);
    expect(instagramShape("IG_FEED", [vid])).toBe(IG_SHAPE.REEL);
    expect(instagramShape("IG_STORY", [img(1)])).toBe(IG_SHAPE.STORY);
    expect(instagramShape("IG_STORY", [vid])).toBe(IG_SHAPE.STORY);
  });

  it("takes none of what Instagram would refuse", () => {
    expect(instagramShape("IG_FEED", [])).toBeNull();
    expect(instagramShape("IG_FEED", Array.from({ length: 11 }, (_, i) => img(i)))).toBeNull();
    expect(instagramShape("IG_FEED", [img(1), vid])).toBeNull();
    expect(instagramShape("IG_FEED", [vid, vid])).toBeNull();
    expect(instagramShape("IG_STORY", [img(1), img(2)])).toBeNull();
    expect(instagramShape("IG_STORY", [])).toBeNull();
  });
});

describe("the containers a destination becomes", () => {
  it("makes a carousel of two pictures with the caption, a tagged person and a collaborator (spec A1)", () => {
    const built = buildContainers({
      kind: "IG_FEED",
      caption: "New in #kurta #eid",
      media: [img(1), img(2)],
      fields: {
        userTags: [{ image: 1, handle: "@asha.styles", x: 0.5, y: 0.25 }],
        collaborators: ["@bhendi.partner"],
        locationId: "112233",
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.shape).toBe(IG_SHAPE.CAROUSEL);
    expect(built.children).toEqual([
      { image_url: "https://cdn.test/p1.jpg", is_carousel_item: "true" },
      {
        image_url: "https://cdn.test/p2.jpg",
        is_carousel_item: "true",
        user_tags: JSON.stringify([{ username: "asha.styles", x: 0.5, y: 0.25 }]),
      },
    ]);
    expect(built.parent).toEqual({
      media_type: "CAROUSEL",
      caption: "New in #kurta #eid",
      collaborators: JSON.stringify(["bhendi.partner"]),
      location_id: "112233",
    });
    expect(withChildren(built.parent, ["c1", "c2"])).toEqual({ ...built.parent, children: "c1,c2" });
  });

  it("makes one image as a single container, its tags on itself", () => {
    const built = buildContainers({
      kind: "IG_FEED",
      caption: "Hello",
      media: [img(1)],
      fields: { ...noFields, userTags: [{ image: 0, handle: "asha", x: 0, y: 1 }] },
    });
    expect(built).toEqual({
      ok: true,
      shape: IG_SHAPE.IMAGE,
      children: [],
      parent: {
        image_url: "https://cdn.test/p1.jpg",
        caption: "Hello",
        user_tags: JSON.stringify([{ username: "asha", x: 0, y: 1 }]),
      },
    });
  });

  it("makes a reel from one video, shared to the feed", () => {
    const built = buildContainers({
      kind: "IG_FEED",
      caption: "Watch",
      media: [vid],
      fields: { ...noFields, collaborators: ["a", "b", "c"] },
    });
    expect(built).toEqual({
      ok: true,
      shape: IG_SHAPE.REEL,
      children: [],
      parent: {
        media_type: "REELS",
        video_url: vid.url,
        caption: "Watch",
        share_to_feed: "true",
        collaborators: JSON.stringify(["a", "b", "c"]),
      },
    });
  });

  it("makes a story from one picture or video, with no caption since a story has none (spec A2)", () => {
    expect(buildContainers({ kind: "IG_STORY", caption: "ignored", media: [img(1)], fields: noFields })).toEqual({
      ok: true,
      shape: IG_SHAPE.STORY,
      children: [],
      parent: { media_type: "STORIES", image_url: "https://cdn.test/p1.jpg" },
    });
    expect(buildContainers({ kind: "IG_STORY", caption: "", media: [vid], fields: noFields })).toEqual({
      ok: true,
      shape: IG_SHAPE.STORY,
      children: [],
      parent: { media_type: "STORIES", video_url: vid.url },
    });
  });

  it("tags people on a story picture (spec R4)", () => {
    const built = buildContainers({
      kind: "IG_STORY",
      caption: "",
      media: [img(1)],
      fields: { ...noFields, userTags: [{ image: 0, handle: "asha", x: 0.2, y: 0.3 }] },
    });
    expect(built.ok && built.parent.user_tags).toBe(JSON.stringify([{ username: "asha", x: 0.2, y: 0.3 }]));
  });

  it("refuses what Instagram does not allow, naming why", () => {
    const refused = (input: Parameters<typeof buildContainers>[0]) => {
      const built = buildContainers(input);
      return built.ok ? null : built.reason;
    };
    const feed = { kind: "IG_FEED" as const, caption: "" };
    expect(refused({ ...feed, media: [], fields: noFields })).toBe(IG_REFUSAL.SHAPE);
    expect(refused({ ...feed, media: [img(1), vid], fields: noFields })).toBe(IG_REFUSAL.SHAPE);
    expect(
      refused({ ...feed, media: [vid], fields: { ...noFields, userTags: [{ image: 0, handle: "a", x: 0, y: 0 }] } }),
    ).toBe(IG_REFUSAL.TAGS_ON_REEL);
    expect(refused({ ...feed, media: [img(1)], fields: { ...noFields, collaborators: ["a", "b", "c", "d"] } })).toBe(
      IG_REFUSAL.TOO_MANY_COLLABORATORS,
    );
    // The same person twice is one collaborator.
    const twice = buildContainers({ ...feed, media: [img(1)], fields: { ...noFields, collaborators: ["a", "@a", "b", "c"] } });
    expect(twice.ok && twice.parent.collaborators).toBe(JSON.stringify(["a", "b", "c"]));
    expect(
      refused({ ...feed, media: [img(1)], fields: { ...noFields, userTags: [{ image: 1, handle: "a", x: 0, y: 0 }] } }),
    ).toBe(IG_REFUSAL.TAG_OFF_PICTURE);
    expect(
      refused({ ...feed, media: [img(1)], fields: { ...noFields, userTags: [{ image: 0, handle: "a", x: 1.2, y: 0 }] } }),
    ).toBe(IG_REFUSAL.TAG_OFF_PICTURE);
    expect(
      refused({ kind: "IG_STORY", caption: "", media: [img(1)], fields: { ...noFields, collaborators: ["a"] } }),
    ).toBe(IG_REFUSAL.NOT_ON_STORY);
    expect(
      refused({ kind: "IG_STORY", caption: "", media: [img(1)], fields: { ...noFields, locationId: "1" } }),
    ).toBe(IG_REFUSAL.NOT_ON_STORY);
  });
});

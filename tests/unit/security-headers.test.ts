/**
 * The Content-Security-Policy is the only control standing between an injected script and
 * a signed-in buyer's session, and it is the kind of control that degrades by one
 * well-meaning edit: a single `'unsafe-inline'` added to make a widget work turns the
 * whole script policy into decoration while leaving the header present and reassuring.
 * These assert the properties that make it worth having, not the exact string.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  contentSecurityPolicy,
  isSelfFramedPath,
  SELF_FRAMED_HEADERS,
  SELF_FRAMED_SOURCE,
  STATIC_SECURITY_HEADERS,
} from "@/lib/security-headers";
import { youtubeEmbedUrl, youtubePosterUrl } from "@server/catalog/media";

const NONCE = "0123456789abcdef0123456789abcdef";

function directive(policy: string, name: string): string {
  const found = policy.split("; ").find((d) => d === name || d.startsWith(name + " "));
  return found ?? "";
}

describe("content security policy", () => {
  const prod = contentSecurityPolicy(NONCE, false);
  const dev = contentSecurityPolicy(NONCE, true);

  it("never allows inline script", () => {
    // The whole point. With 'unsafe-inline' present, an injected <script> runs and the
    // nonce below is theatre.
    expect(directive(prod, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(dev, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("carries the request's nonce, so Next's own inline scripts still run", () => {
    expect(directive(prod, "script-src")).toContain(`'nonce-${NONCE}'`);
  });

  it("allows eval in development only", () => {
    // React's dev build compiles with eval; the production build does not, and shipping
    // the exception would hand an attacker a string-to-code primitive.
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(prod, "script-src")).not.toContain("'unsafe-eval'");
  });

  it("admits the payment gateway on every channel its checkout uses", () => {
    // Razorpay appends checkout.js at runtime (src/components/checkout/razorpay-checkout.ts),
    // renders the modal in an iframe, posts back through a form, and beacons to its own
    // API. Miss one and payment fails in a way that looks like a gateway outage.
    for (const name of ["script-src", "frame-src", "form-action", "connect-src"]) {
      expect(directive(prod, name), `${name} must admit Razorpay`).toContain("razorpay.com");
    }
  });

  it("admits Meta's SDK and Embedded Signup's frames and calls, with scripts from the SDK host only (connect-whatsapp D1)", () => {
    // Connect WhatsApp loads Meta's SDK on tap; its sign-up draws Facebook frames and calls Facebook.
    // A wildcard Facebook host in script-src would let any page Facebook serves run here.
    expect(directive(prod, "script-src")).toContain("https://connect.facebook.net");
    expect(directive(prod, "script-src")).not.toContain("facebook.com");
    expect(directive(prod, "frame-src")).toContain("https://*.facebook.com");
    expect(directive(prod, "connect-src")).toContain("https://*.facebook.com");
    expect(directive(prod, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("admits the video player on the channels its embed actually uses", () => {
    // Regression: the policy inventoried the gateway's channels and the poster image host,
    // and nothing else. The player iframe (ADR-0017) had no entry in `frame-src`, so every
    // product video rendered as Chrome's "This content is blocked" while the poster beside
    // it loaded fine. The hosts are derived from the functions that emit the URLs, so the
    // embed cannot move without this going red.
    const embedHost = new URL(youtubeEmbedUrl("dQw4w9WgXcQ")).origin;
    const posterHost = new URL(youtubePosterUrl("dQw4w9WgXcQ")).origin;
    expect(directive(prod, "frame-src")).toContain(embedHost);
    expect(directive(prod, "img-src")).toContain(posterHost);
  });

  it("lets a video we host actually play, which img-src does not cover", () => {
    // Regression: the policy had no `media-src` at all, so a `<video>` fell back to
    // `default-src 'self'` and every rendition we serve was refused — while the poster
    // beside it loaded, because a poster is an image through the optimizer on this origin.
    // The element mounted, the source was dropped, and the surface just sat there (ADR-0039).
    const previous = process.env.R2_PUBLIC_BASE_URL;
    process.env.R2_PUBLIC_BASE_URL = "https://media.example.test";
    try {
      const policy = contentSecurityPolicy(NONCE, false);
      expect(directive(policy, "media-src")).toContain("https://media.example.test");
    } finally {
      if (previous === undefined) delete process.env.R2_PUBLIC_BASE_URL;
      else process.env.R2_PUBLIC_BASE_URL = previous;
    }
  });

  it("does not lend the media channel the hosts that only serve pictures", () => {
    // A third party allowed to serve a thumbnail has no business streaming bytes into a
    // `<video>` on this origin, so `media-src` is our own bucket and nothing else.
    expect(directive(prod, "media-src")).not.toContain("placehold.co");
    expect(directive(prod, "media-src")).not.toContain("ytimg.com");
    expect(directive(prod, "media-src")).not.toContain("shiprocket.in");
  });

  it("lets the browser write to the object store it uploads through", () => {
    // Regression: `connect-src` listed the payment gateway and nothing else, while every
    // image upload goes browser-to-R2 (ADR-0028). A CSP-blocked `fetch` rejects rather
    // than answering, so this surfaced as `Failed to fetch` with a valid signature, a
    // correct bucket policy and a working route — three layers that all had to be
    // cleared by hand before the policy was suspected.
    const endpoint = process.env.R2_ENDPOINT;
    if (!endpoint) return; // nothing to assert without the variable this derives from
    const host = `https://${new URL(endpoint).hostname}`;
    expect(directive(prod, "connect-src")).toContain(host);
  });

  it("keeps the upload host and the image host as separate questions", () => {
    // Reads come from the public bucket domain, writes go to the credentialed S3
    // endpoint. Allowing one must never be mistaken for allowing the other.
    const base = process.env.R2_PUBLIC_BASE_URL;
    const endpoint = process.env.R2_ENDPOINT;
    if (!base || !endpoint) return;
    const readHost = `https://${new URL(base).hostname}`;
    const writeHost = `https://${new URL(endpoint).hostname}`;
    expect(readHost).not.toBe(writeHost);
    expect(directive(prod, "img-src")).toContain(readHost);
    expect(directive(prod, "connect-src")).toContain(writeHost);
    // The credentialed endpoint is not something the page should be loading images from.
    expect(directive(prod, "img-src")).not.toContain(writeHost);
  });

  it("refuses to be framed, and pins the base URI", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    // An injected <base> silently retargets every relative URL on the page, form posts
    // included — a redirect of the whole checkout without touching a single link.
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
  });

  it("has a default-src, so a directive nobody thought of is not open", () => {
    expect(directive(prod, "default-src")).toBe("default-src 'self'");
  });

  it("upgrades insecure requests in production only", () => {
    expect(prod).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});

describe("static security headers", () => {
  const byKey = new Map(STATIC_SECURITY_HEADERS.map((h) => [h.key, h.value]));

  it.each([
    ["Strict-Transport-Security", /max-age=\d{7,}/],
    ["X-Content-Type-Options", /^nosniff$/],
    ["X-Frame-Options", /^DENY$/],
    ["Referrer-Policy", /strict-origin/],
    ["Permissions-Policy", /camera=\(\)/],
  ])("%s is set", (key, pattern) => {
    const value = byKey.get(key);
    expect(value, `${key} is missing from STATIC_SECURITY_HEADERS`).toBeDefined();
    expect(value).toMatch(pattern);
  });

  it("does not deny the Payment Request API", () => {
    // Razorpay's card and UPI flows use it; `payment=()` fails as a payment method that
    // is silently unavailable rather than as an error anyone would trace back to here.
    expect(byKey.get("Permissions-Policy")).toContain("payment=(self");
  });
});

describe("the look preview alone may be framed, and only by us (storefront-themes D12, Q32)", () => {
  const PREVIEW = "/org/org_1/storefront/preview";
  const NOT_FRAMED = [
    "/org/org_1/storefront",
    "/org/org_1/storefront/look",
    "/org/org_1/storefront/preview/extra",
    "/store/zaveri",
    "/admin/org/org_1/storefront/preview",
    "/checkout",
  ];

  it("names the preview path and nothing else", () => {
    expect(isSelfFramedPath(PREVIEW)).toBe(true);
    for (const path of NOT_FRAMED) expect(isSelfFramedPath(path), path).toBe(false);
  });

  it("the next.config source and the middleware's test agree on the same paths", () => {
    const source = new RegExp(`^${SELF_FRAMED_SOURCE.replace(/:\w+/g, "[^/]+")}$`);
    for (const path of [PREVIEW, ...NOT_FRAMED]) expect(source.test(path), path).toBe(isSelfFramedPath(path));
  });

  it("frames to self on that path, never to another origin", () => {
    const framed = contentSecurityPolicy(NONCE, false, true);
    expect(directive(framed, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive(contentSecurityPolicy(NONCE, false), "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(new Map(SELF_FRAMED_HEADERS.map((h) => [h.key, h.value])).get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("next.config applies the SAMEORIGIN override after DENY, so it wins only there", () => {
    const config = readFileSync("next.config.ts", "utf8");
    const all = config.indexOf('{ source: "/:path*", headers }');
    const framed = config.indexOf("{ source: SELF_FRAMED_SOURCE, headers: SELF_FRAMED_HEADERS }");
    expect(all).toBeGreaterThan(-1);
    expect(framed).toBeGreaterThan(all);
  });

  it("the middleware asks the path, not a constant", () => {
    expect(readFileSync("src/middleware.ts", "utf8")).toContain("isSelfFramedPath(request.nextUrl.pathname)");
  });
});

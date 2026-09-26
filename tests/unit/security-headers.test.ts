/**
 * The Content-Security-Policy is the only control standing between an injected script and
 * a signed-in buyer's session, and it is the kind of control that degrades by one
 * well-meaning edit: a single `'unsafe-inline'` added to make a widget work turns the
 * whole script policy into decoration while leaving the header present and reassuring.
 * These assert the properties that make it worth having, not the exact string.
 */
import { describe, it, expect } from "vitest";
import { contentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/lib/security-headers";
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
    // Razorpay appends checkout.js at runtime (src/services/paymentGatewayService.ts),
    // renders the modal in an iframe, posts back through a form, and beacons to its own
    // API. Miss one and payment fails in a way that looks like a gateway outage.
    for (const name of ["script-src", "frame-src", "form-action", "connect-src"]) {
      expect(directive(prod, name), `${name} must admit Razorpay`).toContain("razorpay.com");
    }
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

/**
 * The Content-Security-Policy is the only control standing between an injected script and
 * a signed-in buyer's session, and it is the kind of control that degrades by one
 * well-meaning edit: a single `'unsafe-inline'` added to make a widget work turns the
 * whole script policy into decoration while leaving the header present and reassuring.
 * These assert the properties that make it worth having, not the exact string.
 */
import { describe, it, expect } from "vitest";
import { contentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/lib/security-headers";

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

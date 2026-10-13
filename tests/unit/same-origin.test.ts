/**
 * A mutation of our API is accepted only from our own origin (ADR-0060).
 *
 * The predicate is pure, so these are real requests with real headers rather than a reading
 * of the middleware's text. Mutation-tested by inverting the final comparison in
 * `isCrossSiteMutation`: the cross-origin and same-origin cases swap verdicts and go red.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CROSS_SITE_REFUSED,
  ORIGIN_CHECK_EXEMPT,
  isCrossSiteMutation,
  ownOrigins,
} from "@/lib/same-origin";

const SHOP = "https://shop.example";

const request = (method: string, path: string, headers: Record<string, string> = {}, base = SHOP) => ({
  method,
  url: base + path,
  headers: new Headers(headers),
});

const refused = (r: ReturnType<typeof request>) => isCrossSiteMutation(r);

describe("a mutation of /api from elsewhere is refused", () => {
  it("a POST with no Origin at all", () => {
    expect(refused(request("POST", "/api/cart"))).toBe(true);
  });

  it("a POST from another origin", () => {
    expect(refused(request("POST", "/api/cart", { origin: "https://evil.example" }))).toBe(true);
  });

  it("a POST whose Origin is the opaque `null`", () => {
    // What a sandboxed frame or a redirect chain sends. Not ours.
    expect(refused(request("POST", "/api/cart", { origin: "null" }))).toBe(true);
  });

  it.each(["PUT", "PATCH", "DELETE"])("a %s without Origin", (method) => {
    expect(refused(request(method, "/api/admin/banners/1"))).toBe(true);
  });

  it("a same-site but different-origin subdomain", () => {
    expect(refused(request("POST", "/api/cart", { origin: "https://blog.shop.example" }))).toBe(true);
  });

  it("a Referer from another site, when there is no Origin", () => {
    expect(refused(request("POST", "/api/cart", { referer: "https://evil.example/page" }))).toBe(true);
  });
});

describe("our own requests pass", () => {
  it("a POST with our Origin", () => {
    expect(refused(request("POST", "/api/cart", { origin: SHOP }))).toBe(false);
  });

  it("a GET without Origin — reads are not what this guards", () => {
    expect(refused(request("GET", "/api/products"))).toBe(false);
    expect(refused(request("HEAD", "/api/products"))).toBe(false);
    expect(refused(request("OPTIONS", "/api/products"))).toBe(false);
  });

  it("`Sec-Fetch-Site: same-origin` without an Origin header", () => {
    expect(refused(request("POST", "/api/cart", { "sec-fetch-site": "same-origin" }))).toBe(false);
  });

  it("a Referer on our origin, when there is no Origin", () => {
    expect(refused(request("POST", "/api/cart", { referer: `${SHOP}/cart` }))).toBe(false);
  });

  it("a mutation outside /api — not this guard's concern", () => {
    expect(refused(request("POST", "/checkout"))).toBe(false);
  });
});

describe("behind the host's proxy", () => {
  // The server sees its internal address; the browser addressed the public one, and the proxy
  // says so in the forwarded pair. Without those headers the same request must be refused, or
  // the forwarded path is not what let it through.
  const internal = "http://localhost:3000";

  it("the forwarded host and proto make the public origin ours", () => {
    const forwarded = request(
      "POST",
      "/api/cart",
      { origin: SHOP, "x-forwarded-host": "shop.example", "x-forwarded-proto": "https" },
      internal,
    );
    expect(refused(forwarded)).toBe(false);
    expect(refused(request("POST", "/api/cart", { origin: SHOP }, internal))).toBe(true);
  });

  it("takes the first entry of a forwarding chain", () => {
    const chained = request(
      "POST",
      "/api/cart",
      { origin: SHOP, "x-forwarded-host": "shop.example, proxy.internal", "x-forwarded-proto": "https, http" },
      internal,
    );
    expect(refused(chained)).toBe(false);
  });

  it("the Host header stands in when nothing is forwarded", () => {
    expect(ownOrigins(request("POST", "/api/cart", { host: "shop.example" }, "https://0.0.0.0"))).toContain(SHOP);
  });
});

describe("the configured app origin counts as ours", () => {
  const previous = { app: process.env.NEXT_PUBLIC_APP_URL, auth: process.env.NEXTAUTH_URL };
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  afterEach(() => {
    restore("NEXT_PUBLIC_APP_URL", previous.app);
    restore("NEXTAUTH_URL", previous.auth);
  });

  it("derived the way outbound links are (server/shared/app-url.ts)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.shop.example/";
    expect(refused(request("POST", "/api/cart", { origin: "https://www.shop.example" }))).toBe(false);
  });

  it("and its absence refuses nothing by itself", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    expect(refused(request("POST", "/api/cart", { origin: SHOP }))).toBe(false);
  });
});

describe("callers outside this origin that are meant to post here", () => {
  it.each([
    "/api/webhooks/razorpay",
    "/api/webhooks/shipping/shiprocket",
    "/api/auth/callback/credentials",
    "/api/auth/signout",
  ])("%s without an Origin is allowed", (path) => {
    expect(refused(request("POST", path))).toBe(false);
  });

  it("an exemption is a path, not a prefix of one", () => {
    expect(refused(request("POST", "/api/webhooks/razorpay-lookalike"))).toBe(true);
    expect(refused(request("POST", "/api/authors"))).toBe(true);
  });

  it("every exempt webhook is declared externally called, so the two lists cannot drift apart", () => {
    const reachability = readFileSync("tests/unit/route-reachability.test.ts", "utf8");
    const declared = reachability.slice(
      reachability.indexOf("const EXTERNALLY_CALLED"),
      reachability.indexOf("};", reachability.indexOf("const EXTERNALLY_CALLED")),
    );
    for (const path of ORIGIN_CHECK_EXEMPT.filter((p) => !p.endsWith("/"))) {
      expect(declared, `${path} is exempt from the origin check but has no declared external caller`).toContain(
        `"${path}"`,
      );
    }
  });
});

describe("the middleware applies it", () => {
  const source = readFileSync("src/middleware.ts", "utf8");

  it("calls the predicate and answers in the envelope", () => {
    expect(source).toContain("isCrossSiteMutation(request)");
    expect(source).toContain("CROSS_SITE_REFUSED");
    expect(source).toMatch(/status:\s*403/);
    expect(typeof CROSS_SITE_REFUSED.error).toBe("string");
  });

  it("its matcher reaches the API", () => {
    const matcher = source.slice(source.indexOf("matcher:"));
    const patterns = [...matcher.matchAll(/"([^"]+)"/g)]
      .map((m) => m[1])
      .filter((p) => p.startsWith("/"))
      .map((p) => new RegExp("^" + p.replace(/:path\*/g, ".*").replace(/:\w+/g, "[^/]+") + "$"));
    for (const path of ["/api/cart", "/api/admin/banners/1", "/api/orders/abc.def"]) {
      expect(patterns.some((re) => re.test(path)), path).toBe(true);
    }
  });

  it("the dead module it replaces is gone", () => {
    expect(() => readFileSync("src/lib/csrf.ts")).toThrow(/ENOENT/);
  });
});

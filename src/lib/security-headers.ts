// Relative, not `@server/…`: next.config.ts loads this file before path aliases exist.
import { ROUTES } from "../../server/shared/routes";
/**
 * Response security headers, and the Content-Security-Policy in particular.
 *
 * **What this does and does not protect.** Faking a payment is already impossible without
 * the gateway key secret: the charged amount is read from the persisted order and never
 * from a request body ([ADR-0002](../../docs/adr/0002-server-holds-pricing-authority.md)),
 * and `paymentStatus: "paid"` is written only after an HMAC over `order_id|payment_id`
 * verifies against the order the gateway id was persisted against
 * ([ADR-0005](../../docs/adr/0005-payment-state-server-only.md)). No amount of scripting in
 * the browser reaches either. What scripting *does* reach is everything around the
 * payment — the session, the address book, the basket — so the residual risk was never
 * "forge a confirmation", it was "run any script at all on our origin". This closes that.
 *
 * **Nonce, not `unsafe-inline`.** Every inline script must carry the per-request nonce
 * issued in `src/middleware.ts`, so an injected `<script>` — however it got into the
 * markup — does not execute. `unsafe-inline` would make the whole policy decorative,
 * which is the usual way a CSP ends up present and worthless.
 *
 * `strict-dynamic` is deliberately *not* used: it would discard the host allowlist below
 * in supporting browsers, and Razorpay's checkout script is appended at runtime by
 * `src/components/checkout/razorpay-checkout.ts` rather than rendered with a nonce. The explicit
 * allowlist covers that case and fails visibly rather than silently.
 */

/** Razorpay serves checkout from one apex and phones home to several subdomains. */
const RAZORPAY = "https://*.razorpay.com";

/** An embedded video's frame (ADR-0017). `youtubeEmbedUrl` in `server/catalog/media.ts` emits it.
 *  A video we host is not a frame: it is a `<video>` reading our bucket under `media-src`. */
const YOUTUBE_EMBED = "https://www.youtube-nocookie.com";

/** The bucket's public read domain: every stored image, and every video rendition (ADR-0028). */
function storeHost(): string[] {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return [];
  try {
    return [`https://${new URL(base).hostname}`];
  } catch {
    // A malformed R2_PUBLIC_BASE_URL already breaks image delivery (next.config.ts reads
    // the same variable); it must not also break every response.
    return [];
  }
}

/** Listing pictures hotlinked from the marketplaces, not run through the optimizer (channel-import Q14). */
const MARKETPLACE_IMAGE_HOSTS = ["https://m.media-amazon.com", "https://*.ssl-images-amazon.com", "https://*.flixcart.com"];

/** Hosts `next/image` is allowed to render from — kept beside `next.config.ts`'s list. */
function imageHosts(): string[] {
  // Google sign-in avatars: the browser fetches them itself now the optimizer is gone (ADR-0075).
  return [
    "https://i.ytimg.com",
    "https://placehold.co",
    "https://shiprocket.in",
    "https://lh3.googleusercontent.com",
    ...MARKETPLACE_IMAGE_HOSTS,
    ...storeHost(),
  ];
}

/**
 * The host a browser PUTs to during a direct upload (ADR-0028, bulk-catalog-upload D10).
 *
 * **Not the same host as `imageHosts()`.** Reads come from the public bucket domain;
 * writes go to the credentialed S3 endpoint, and allowing one says nothing about the
 * other. Missing here, every browser-to-store upload — the product gallery, the bulk
 * wizard, a profile picture, a review photograph — fails with a bare `Failed to fetch`,
 * because a CSP-blocked `fetch` rejects rather than answering. The signature, the bucket
 * policy and the route are all uninvolved and all look correct while it happens.
 */
function uploadHosts(): string[] {
  const endpoint = process.env.R2_ENDPOINT;
  if (!endpoint) return [];
  try {
    return [`https://${new URL(endpoint).hostname}`];
  } catch {
    // A malformed endpoint already breaks every upload at the signing step; it must not
    // also break every response.
    return [];
  }
}

/**
 * The one page our own pages may frame: the look picker's live preview, drawn in same-origin
 * iframes so each frame's width drives its breakpoints (storefront-themes D12, Q32). Everything
 * else stays unframeable.
 */
export const SELF_FRAMED_SOURCE = ROUTES.org.storefrontPreview(":orgId");
const SELF_FRAMED_PATH = /^\/org\/[^/]+\/storefront\/preview\/?$/;
export const isSelfFramedPath = (pathname: string) => SELF_FRAMED_PATH.test(pathname);

/** Applied after the static set in `next.config.ts`, so on that path alone it wins over `DENY`. */
export const SELF_FRAMED_HEADERS: Array<{ key: string; value: string }> = [{ key: "X-Frame-Options", value: "SAMEORIGIN" }];

export function contentSecurityPolicy(nonce: string, isDev: boolean, selfFramed = false): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    // No 'unsafe-inline'. React's dev build compiles with eval, the production build
    // does not — so the exception is scoped to dev rather than shipped.
    "script-src": ["'self'", `'nonce-${nonce}'`, RAZORPAY, ...(isDev ? ["'unsafe-eval'"] : [])],

    // Next inlines critical CSS and Tailwind emits style attributes; a nonce cannot reach
    // either. Style injection is a defacement vector, not an execution one, so this is the
    // one relaxation the policy makes.
    "style-src": ["'self'", "'unsafe-inline'"],

    // `blob:` and `data:` are the local preview of an image a user has just picked, before
    // it is uploaded — the one case ADR-0026 lets skip the optimizer.
    "img-src": ["'self'", "data:", "blob:", ...imageHosts()],

    // A `<video>` reads its bytes under `media-src`, which falls back to `default-src` when
    // absent — so our own renditions, served from the bucket domain, were refused while the
    // poster beside them loaded, because a poster is an image through the optimizer on this
    // origin (ADR-0039). The element mounts, the source is dropped, nothing says why.
    "media-src": ["'self'", "blob:", ...storeHost()],

    "font-src": ["'self'", "data:"], // next/font/google self-hosts at build time

    "connect-src": [
      "'self'",
      RAZORPAY,
      "https://lumberjack.razorpay.com",
      "https://vitals.vercel-insights.com",
      // Where the bytes of a direct upload actually go. See `uploadHosts()` for why
      // this is a different host from the one images are read back from.
      ...uploadHosts(),
      ...(isDev ? ["ws:", "http://localhost:*"] : []),
    ],

    // The Razorpay checkout modal and the product video player are both iframes on
    // someone else's origin. Chrome reports a refused frame as "This content is blocked",
    // which is how a missing host here surfaced as a broken gallery, not a policy error.
    "frame-src": ["'self'", RAZORPAY, YOUTUBE_EMBED],
    // Razorpay's bank/UPI redirect posts back through a form.
    "form-action": ["'self'", RAZORPAY],

    // Clickjacking: nothing may frame this site. `X-Frame-Options` below says the same
    // thing to browsers that predate this directive.
    // The look preview alone may be framed, and only by us (`SELF_FRAMED_SOURCE`).
    "frame-ancestors": [selfFramed ? "'self'" : "'none'"],
    "base-uri": ["'self'"], // an injected <base> retargets every relative URL on the page
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

/**
 * Headers that do not vary per request. Applied in `next.config.ts` so they reach static
 * assets too, which never run middleware.
 */
export const STATIC_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  // Two years, preloadable. Only ever sent over HTTPS, so local http development is
  // unaffected — but note that a browser that has seen this header will refuse plain
  // http to this host until it expires.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Stops a browser second-guessing a Content-Type, which is how an uploaded image
  // becomes an executed script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy companion to `frame-ancestors 'none'`.
  { key: "X-Frame-Options", value: "DENY" },
  // A full URL leaks order codes and search terms to every third party an outbound link
  // reaches; the origin alone is enough for their analytics.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs a camera, a microphone or a location, so nothing may ask. `payment`
  // stays open to us and to the gateway — Razorpay checkout uses the Payment Request API
  // for card and UPI flows, and denying it fails as a silently unavailable payment method.
  { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), usb=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")' },
];

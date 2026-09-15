/**
 * Pre-launch crawl block. `BLOCK_CRAWLERS=1` in the deployment environment tells
 * every compliant crawler to stay away: robots.txt disallows everything, the
 * sitemap advertises nothing, and next.config.ts stamps `X-Robots-Tag: noindex`
 * on every response for bots that skip robots.txt but honour the header.
 *
 * Delete the variable at launch. While it is set, the 410 purge of the old
 * WordPress index (src/middleware.ts) is paused too — a crawler that may not
 * fetch never sees the 410 — so the old-URL cleanup resumes only after launch.
 *
 * Read at call time, not module load, so tests can flip it. Non-compliant
 * scrapers ignore all of this; those are a Vercel Firewall concern, not code.
 */
export const crawlersBlocked = () => process.env.BLOCK_CRAWLERS === "1";

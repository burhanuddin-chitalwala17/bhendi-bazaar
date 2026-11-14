/**
 * Every org route method and every job is classified for the paid-feature locks
 * (subscriptions/feature-access D9, the shape of ADR-0063). Reads the route tree and the job
 * registry, not the registry's own claims: an unclassified route or job fails, an entry with nothing
 * behind it fails, and a route classified paid whose `withOrg` does not carry that feature fails.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { JOB_FEATURES, ORG_ROUTE_FEATURES } from "@server/subscriptions/feature-registry";
import { FEATURE } from "@server/subscriptions/feature-access.types";

const ROOT = resolve(__dirname, "../..");
const ORG_API = join(ROOT, "src/app/api/org");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const FEATURE_CONST: Record<string, string> = Object.fromEntries(Object.entries(FEATURE).map(([k, v]) => [v, `FEATURE.${k}`]));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : /\/route\.tsx?$/.test(path) ? [path] : [];
  });
}

const urlOf = (file: string) => "/" + relative(ROOT, file).replace(/^src\/app\//, "").replace(/\/route\.tsx?$/, "");

/** `"POST /api/org/[orgId]/enhancements"` → that method's own `withOrg(...)` call, as text. */
const routes = new Map<string, string>();
for (const file of walk(ORG_API)) {
  const source = readFileSync(file, "utf8");
  const starts = [...source.matchAll(/export const ([A-Z]+) = /g)].filter((m) => METHODS.includes(m[1]));
  starts.forEach((m, i) => {
    const end = starts[i + 1]?.index ?? source.length;
    routes.set(`${m[1]} ${urlOf(file)}`, source.slice(m.index, end));
  });
}

const jobTypes = (() => {
  const found = new Set<string>();
  const scan = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) scan(path);
      else if (/\.jobs?\.ts$/.test(entry)) {
        for (const m of readFileSync(path, "utf8").matchAll(/\btype:\s*"([a-z][a-z.-]*)"/g)) found.add(m[1]);
      }
    }
  };
  scan(join(ROOT, "server"));
  return found;
})();

describe("every call site is classified for the paid-feature locks (feature-access D9)", () => {
  it("the scan reaches the tree it claims to measure", () => {
    expect(routes.size).toBeGreaterThan(60);
    expect(jobTypes.size).toBeGreaterThan(15);
  });

  it("every org route method is classified", () => {
    expect([...routes.keys()].filter((key) => !(key in ORG_ROUTE_FEATURES))).toEqual([]);
  });

  it("every classified route still exists", () => {
    expect(Object.keys(ORG_ROUTE_FEATURES).filter((key) => !routes.has(key))).toEqual([]);
  });

  it("a paid route passes its feature to withOrg, so it refuses before its handler", () => {
    const unguarded = Object.entries(ORG_ROUTE_FEATURES)
      .filter(([, c]) => "feature" in c)
      .filter(([key, c]) => !routes.get(key)?.includes(`{ feature: ${FEATURE_CONST[(c as { feature: string }).feature]} }`))
      .map(([key]) => key);
    expect(unguarded).toEqual([]);
  });

  it("a free route carries a reason, never an empty one", () => {
    expect(Object.entries(ORG_ROUTE_FEATURES).filter(([, c]) => "core" in c && c.core.trim().length < 10).map(([k]) => k)).toEqual([]);
  });

  it("every job type is classified, and every classified job exists", () => {
    expect([...jobTypes].filter((type) => !(type in JOB_FEATURES))).toEqual([]);
    expect(Object.keys(JOB_FEATURES).filter((type) => !jobTypes.has(type))).toEqual([]);
  });
});

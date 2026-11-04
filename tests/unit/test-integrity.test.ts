/**
 * The tests are checked too, because a test that does not run cannot fail.
 *
 * Six integration suites gated themselves on `url.pathname === "/bhendi_bazaar_dev"` while CI
 * runs against `bhendi_bazaar_ci`. They had never executed in CI — `order-transaction`, the
 * guard on Invariants 1, 3 and 6, among them — and the output said `↓ skipped`, which reads
 * like a pass at the bottom of a run. Three cases in `join-equivalence` went further and
 * *passed* on the empty schema by comparing `[]` to `[]`.
 *
 * Nothing in the build notices either failure mode, so they are asserted here:
 *
 *  - one definition of what a throwaway database is, imported rather than re-spelled;
 *  - in CI, that definition must hold — the integration layer cannot quietly vanish;
 *  - a suite may depend on seeded data only if it is named below, with a reason;
 *  - no `.only`, which silently disables every other case in its file;
 *  - every test has at least one assertion.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { isDisposableDb } from "../helpers/test-db";

const ROOT = resolve(__dirname, "../..");

/**
 * Suites that need rows they did not create.
 *
 * The seed is destructive and refuses to run in CI (Invariant 7), so a suite here is dev-only
 * by construction — it must say why, and the list shrinks only. Everything else builds its own
 * world through `ensureFixtures`, which is what let six suites start running in CI at all.
 */
const DATA_DEPENDENT: Record<string, string> = {
  "tests/integration/join-equivalence.test.ts":
    "Pins deep equality between Prisma's two relation-load strategies across every aggregate's " +
    "real include tree. A two-row fixture would not exercise nested filtered includes, so it " +
    "needs a populated catalogue and skips, loudly, where there is none.",
};

/**
 * Unit suites allowed to gate on the environment, and what they gate on.
 *
 * Each must also refuse to skip in CI from inside itself, because a gate that quietly stops
 * firing where it matters is the failure this whole file exists for.
 */
const ENVIRONMENT_GATED: Record<string, string> = {
  "tests/unit/docs-integrity.test.ts":
    "Needs git history to tell when a covered file changed shape; CI checks out with " +
    "fetch-depth: 0, and the suite asserts that it did rather than skipping quietly.",
  "tests/unit/video-transcode.test.ts":
    "Runs ffmpeg on a generated clip; CI installs ffmpeg in the unit job, and the suite asserts " +
    "that it is present there rather than skipping quietly.",
};

function testFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.test\.tsx?$/.test(p)) out.push(p);
    }
  };
  walk(join(ROOT, "tests"));
  return out;
}

/** Comments are stripped: a rule about code should not fire on prose describing the rule. */
const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const files = testFiles().map((f) => {
  const text = readFileSync(f, "utf8");
  return { path: relative(ROOT, f), text, code: withoutComments(text) };
});
const integration = files.filter((f) => f.path.startsWith("tests/integration/"));

describe("the test suite cannot quietly stop testing", () => {
  it("the scan reaches the files it claims to check", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(integration.length).toBeGreaterThan(5);
  });

  it("no suite writes its own definition of a throwaway database", () => {
    // Nine wrote their own and three spellings disagreed, which is how the CI database fell
    // outside six of them. One definition, imported.
    const offenders = files
      .filter((f) => f.path !== "tests/unit/test-integrity.test.ts")
      .filter((f) => /\b(isLocalDb|isDisposableDb|isSeededDb)\s*=/.test(f.code))
      .map((f) => f.path);

    expect(
      offenders,
      "Import `isDisposableDb` from tests/helpers/test-db instead of re-deriving it:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("every database-gated suite gates on that one definition", () => {
    const offenders = integration
      .filter((f) => /describe\.(skipIf|runIf)\(/.test(f.code))
      .filter((f) => !f.text.includes('from "../helpers/test-db"'))
      .map((f) => f.path);

    expect(
      offenders,
      "A suite that decides for itself whether to run will one day decide wrong:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("the integration layer runs in CI", () => {
    // The failure this catches is a green run with 43 of 51 integration tests skipped. If CI's
    // DATABASE_URL ever stops matching, this fails in CI and nowhere else — which is right,
    // because that is the only place the claim is about.
    if (!process.env.CI) return expect(files.length).toBeGreaterThan(100);

    expect(
      isDisposableDb,
      `CI's DATABASE_URL (${process.env.DATABASE_URL ?? "unset"}) is not one this suite will ` +
        "write to, so every integration suite is skipping. Point CI at a disposable database " +
        "or add it to DISPOSABLE_DATABASES.",
    ).toBe(true);
  });

  it("only the listed suites depend on data they did not create", () => {
    const offenders = integration
      .filter((f) => !(f.path in DATA_DEPENDENT))
      .filter((f) => /findFirstOrThrow|findUniqueOrThrow/.test(f.code))
      .filter((f) => !/ensureFixtures|ensureOrgMember/.test(f.code))
      .map((f) => f.path);

    expect(
      offenders,
      "A fixture read with `findFirstOrThrow` only works where someone already seeded. Build " +
        "the world with `ensureFixtures`, or add the suite to DATA_DEPENDENT with why:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("no fixture or suite borrows a row it did not create", () => {
    // `findFirst` with no `where` hands back whichever real row comes first, and a suite that then
    // writes to it rewrites the owner's data: category product types reset, an org's channels gone.
    const UNSCOPED = /\.findFirst(?:OrThrow)?\(\s*(?:\)|\{\s*(?:select|include|orderBy)\b)/;
    const helper = {
      path: "tests/helpers/test-db.ts",
      code: withoutComments(readFileSync(join(ROOT, "tests/helpers/test-db.ts"), "utf8")),
    };
    const offenders = [helper, ...integration.filter((f) => !(f.path in DATA_DEPENDENT))]
      .filter((f) => UNSCOPED.test(f.code))
      .map((f) => f.path);

    expect(
      offenders,
      "Scope the read to a row the test created, or use a fixture from `ensureFixtures`, which " +
        "owns its rows by fixed test keys:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("every declared exception still exists and still says why", () => {
    const paths = new Set(files.map((f) => f.path));
    const declared = { ...DATA_DEPENDENT, ...ENVIRONMENT_GATED };
    const stale = Object.keys(declared).filter((p) => !paths.has(p));
    expect(stale, `Listed but no longer a test file:\n${stale.join("\n")}`).toEqual([]);

    const vague = Object.entries(declared).filter(([, why]) => why.trim().length < 60);
    expect(vague.map(([p]) => p), "A reason short enough to be a shrug is not a reason.").toEqual([]);
  });

  it("no test is focused with .only", () => {
    // `it.only` passes the file and silently skips its siblings. Committed once, it hides
    // everything else in that file for as long as nobody looks.
    const offenders = files
      .filter((f) => f.path !== "tests/unit/test-integrity.test.ts")
      .filter((f) => /\b(it|test|describe)\.only\b/.test(f.code))
      .map((f) => f.path);
    expect(offenders, `.only disables every other case in the file:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no assertion accepts any error at all", () => {
    // A bare `.toThrow()` passes on a TypeError from the test's own setup, so a genuine
    // regression — an authorisation check that stopped running, a schema that stopped
    // rejecting — looks exactly like a passing test. Name the error or match the message.
    const offenders = files
      .filter((f) => f.path !== "tests/unit/test-integrity.test.ts")
      .filter((f) => /(?<!\.not)\.(?:rejects\.)?toThrow(?:Error)?\(\)/.test(f.code))
      .map((f) => f.path);

    expect(
      offenders,
      "Give `.toThrow()` an error class or a message pattern:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("only a declared unit suite may decide not to run", () => {
    // A unit test has no database and usually no excuse. The one that does says so here, and
    // refuses to skip in CI from inside itself — an environment gate that never fires where it
    // matters is the same silent hole as a wrong database name.
    const offenders = files
      .filter((f) => !f.path.startsWith("tests/integration/"))
      .filter((f) => f.path !== "tests/unit/test-integrity.test.ts")
      .filter((f) => !(f.path in ENVIRONMENT_GATED))
      .filter((f) => /\b(describe|it|test)\.(skipIf|runIf)\(/.test(f.code))
      .map((f) => f.path);
    expect(
      offenders,
      `A unit test that skips is a unit test that is hiding:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("every test asserts something", () => {
    const offenders: string[] = [];
    for (const { path, code } of files) {
      for (const [, name, body] of code.matchAll(
        /\b(?:it|test)\(\s*["'`](.+?)["'`]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([\s\S]*?)\n  \}\)/g,
      )) {
        // `expectInternallyConsistent(...)` counts: a shared helper whose name starts with
        // `expect` is where several of these keep their assertions. The gate cannot follow
        // arbitrary indirection, so a helper that asserts nothing would slip through — but a
        // helper named `expect*` that does not assert is a lie this rule is not the cure for.
        if (!/\bexpect\w*\s*\(|\bassert\w*\s*\(/.test(body)) offenders.push(`${path} — "${name}"`);
      }
    }
    expect(
      offenders,
      "A test with no assertion passes as long as it does not throw, which is a much weaker " +
        "claim than the name promises:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });
});

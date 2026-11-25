import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { citedQIds, definedQIds, findOffenders, foreignNamesFrom, qGaps, report } from "../../scripts/main-ready.mjs";
import { retiredFiles } from "../../scripts/spec.mjs";

const ROOT = resolve(__dirname, "../..");
const spec = (status: string) => `# Spec\n\n- **Status:** ${status}\n- **Summary:** x\n`;

function judge(tree: Record<string, string>) {
  return findOffenders(Object.keys(tree), (p: string) => tree[p]);
}

describe("main-ready: what main may hold", () => {
  it("passes a tree of shipped specs, each with spec.md and decisions.md", () => {
    const offenders = judge({
      "docs/specs/README.md": "",
      "docs/specs/gift-wrap/spec.md": spec("✅ Implemented — PR-9"),
      "docs/specs/gift-wrap/decisions.md": "",
      "docs/specs/media/viewer/spec.md": spec("Implemented"),
      "src/components/shared/overlays/handoff-sheet.tsx": "",
    });
    expect(offenders).toEqual([]);
    expect(report(offenders)).toMatch(/only finished work/);
  });

  it("refuses a spec whose status does not ship, and says how to fix it", () => {
    const offenders = judge({ "docs/specs/seo/spec.md": spec("Accepted — units 1–3 implemented"), "docs/specs/seo/trd.md": "" });
    expect(offenders).toHaveLength(1);
    expect(offenders[0].path).toBe("docs/specs/seo/");
    expect(offenders[0].fix).toMatch(/feature branch/);
  });

  it("refuses a trd, ux, prototype or note left beside a shipped spec", () => {
    const offenders = judge({
      "docs/specs/gift-wrap/spec.md": spec("Implemented"),
      "docs/specs/gift-wrap/decisions.md": "",
      "docs/specs/gift-wrap/trd.md": "",
      "docs/specs/gift-wrap/ux.md": "",
      "docs/specs/gift-wrap/prototype.html": "",
    });
    expect(offenders.map((o) => o.path)).toEqual(["docs/specs/gift-wrap/trd.md", "docs/specs/gift-wrap/ux.md", "docs/specs/gift-wrap/prototype.html"]);
    expect(offenders[0].fix).toMatch(/spec:status -- gift-wrap/);
  });

  it("refuses session notes anywhere and stray files in the specs tree", () => {
    const paths = judge({
      "handoff/u1.md": "",
      "docs/specs/listing/HANDOFF.md": "",
      "docs/specs/notes.md": "",
      "docs/specs/subs/feature/spec.md": spec("Implemented"),
    }).map((o) => o.path);
    expect(paths).toEqual(["handoff/u1.md", "docs/specs/listing/HANDOFF.md", "docs/specs/notes.md", "docs/specs/listing/"]);
  });

  it("lets a container folder hold child spec folders without a spec of its own", () => {
    expect(judge({ "docs/specs/subs/feature/spec.md": spec("Implemented") })).toEqual([]);
  });

  it("keeps an unshipped programme parent with a shipped child, as the reasoning its children cite", () => {
    const tree = {
      "docs/specs/prog/spec.md": spec("Draft — programme overview"),
      "docs/specs/prog/decisions.md": "",
      "docs/specs/prog/done/spec.md": spec("Implemented"),
    };
    expect(judge(tree)).toEqual([]);
  });

  it("refuses planning files in a programme parent", () => {
    const offenders = judge({
      "docs/specs/prog/spec.md": spec("Accepted"),
      "docs/specs/prog/trd.md": "",
      "docs/specs/prog/spike.md": "",
      "docs/specs/prog/done/spec.md": spec("Implemented"),
    });
    expect(offenders.map((o) => o.path)).toEqual(["docs/specs/prog/trd.md", "docs/specs/prog/spike.md"]);
    expect(offenders[0].problem).toMatch(/programme parent/);
  });

  it("refuses a parent whose children have none of them shipped", () => {
    const paths = judge({
      "docs/specs/prog/spec.md": spec("Draft"),
      "docs/specs/prog/next/spec.md": spec("Accepted"),
    }).map((o) => o.path);
    expect(paths).toEqual(["docs/specs/prog/", "docs/specs/prog/next/"]);
  });
});

describe("main-ready: a retired TRD's reasoning survives in decisions.md", () => {
  const decisions = "| Q | Question |\n|---|---|\n| Q1 | a |\n| Q2 | b |\n\n## Parked (Later)\n- Q9 — later\n";

  it("reads the ids a log defines: rows and parked lines", () => {
    expect([...definedQIds(decisions)]).toEqual(["Q1", "Q2", "Q9"]);
  });

  it("counts a range as every id inside it", () => {
    expect([...citedQIds("see Q3–Q5 and Q8")]).toEqual(["Q3", "Q4", "Q5", "Q8"]);
    expect([...citedQIds("Q7–Q5")]).toEqual(["Q5", "Q6", "Q7"]);
  });

  it("leaves ids that belong to another log: parent, a named feature or domain, a link out of the folder", () => {
    const foreign = new Set(["shipping", "own-store"]);
    const text = "parent Q30, Q31; parent's Q40; (shipping Q32); own-store Q4; [listing](../spec.md) Q2, Q11; ours Q6";
    expect([...citedQIds(text, foreign)]).toEqual(["Q6"]);
  });

  it("lists every cited id the log lacks, and all of them when there is no log", () => {
    expect(qGaps(["Q1 and Q3", "(Q12) Q9"], decisions, new Set())).toEqual(["Q3", "Q12"]);
    expect(qGaps(["Q1"], null, new Set())).toEqual(["Q1"]);
  });

  it("takes foreign names from spec folders and server domains", () => {
    const names = foreignNamesFrom(["docs/specs/own-store/bulk-sheet/spec.md", "server/shipping/x.ts", "src/a.ts"]);
    expect([...names].sort()).toEqual(["bulk-sheet", "own-store", "shipping"]);
  });

  it("spec:status retires every file and folder but spec.md, decisions.md and child specs", () => {
    const entries = ["spec.md", "decisions.md", "trd.md", "ux.md", "prototype.html", "prototype", "variants"];
    expect(retiredFiles(entries, (f: string) => f === "variants")).toEqual(["trd.md", "ux.md", "prototype.html", "prototype"]);
  });
});

describe("main-ready as a module", () => {
  it("imports cleanly when argv[1] is not a file (node -e, a script passing arguments)", () => {
    const url = pathToFileURL(join(ROOT, "scripts/main-ready.mjs")).href;
    const out = spawnSync("node", ["--input-type=module", "-e", `import ${JSON.stringify(url)}`, "not-a-file"], { encoding: "utf8" });
    expect(out.stderr).toBe("");
    expect(out.status).toBe(0);
  });
});

// The hook and the --rev path judge a commit, not the working tree; proven against a throwaway repository.
describe("main-ready against a commit, and the pre-push hook", () => {
  let repo: string;
  // The machine's own git config (global hooks, signing) must not reach the throwaway repository.
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const run = (cmd: string, args: string[], input?: string) => spawnSync(cmd, args, { cwd: repo, encoding: "utf8", input, env });
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8", env }).trim();
  const write = (p: string, text: string) => {
    mkdirSync(dirname(join(repo, p)), { recursive: true });
    writeFileSync(join(repo, p), text);
  };

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "main-ready-"));
    git("init", "-q", "-b", "work");
    git("config", "user.email", "t@t.test");
    git("config", "user.name", "t");
    cpSync(join(ROOT, "scripts/main-ready.mjs"), join(repo, "scripts/main-ready.mjs"));
    cpSync(join(ROOT, ".githooks/pre-push"), join(repo, ".githooks/pre-push"));
    chmodSync(join(repo, ".githooks/pre-push"), 0o755);
    write("docs/specs/gift-wrap/spec.md", spec("Accepted"));
    write("docs/specs/gift-wrap/trd.md", "");
    git("add", "-A");
    git("commit", "-qm", "planning");
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it("judges the commit named, not the working tree", () => {
    const planning = git("rev-parse", "HEAD");
    write("docs/specs/gift-wrap/spec.md", spec("Implemented"));
    rmSync(join(repo, "docs/specs/gift-wrap/trd.md"));
    git("add", "-A");
    git("commit", "-qm", "shipped");
    const shipped = git("rev-parse", "HEAD");

    const bad = run("node", ["scripts/main-ready.mjs", "--rev", planning]);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/gift-wrap\/.*\n.*does not ship/);
    expect(run("node", ["scripts/main-ready.mjs", "--rev", shipped]).status).toBe(0);

    // The working tree is clean now, so only --rev can have seen the planning commit's TRD.
    const hook = (sha: string, ref: string) => run("sh", [".githooks/pre-push", "origin", "url"], `refs/heads/work ${sha} ${ref} ${"0".repeat(40)}\n`);
    const blocked = hook(planning, "refs/heads/main");
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toMatch(/does not ship/);
    expect(blocked.stderr).not.toMatch(/no-verify/);
    expect(hook(planning, "refs/heads/feature").status).toBe(0);
    expect(hook(shipped, "refs/heads/main").status).toBe(0);
    expect(hook("0".repeat(40), "refs/heads/main").status).toBe(0); // deleting a ref lands no tree
  });

  it("reads a non-ASCII path from a commit", () => {
    write("docs/specs/café/spec.md", spec("Draft"));
    git("add", "-A");
    git("commit", "-qm", "accent");
    const out = run("node", ["scripts/main-ready.mjs", "--rev", git("rev-parse", "HEAD")]);
    expect(out.status).toBe(1);
    expect(out.stderr).toMatch(/docs\/specs\/café\//);
  });
});

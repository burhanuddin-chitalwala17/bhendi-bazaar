// A guard is trusted only after it has been seen to fail (ADR-0056 D4). This applies one mutation, runs the
// guard's tests, and always restores the file — a mutation left in the tree is worse than none (ADR-0081).
//
//   npm run mutate -- <file> <find> <replace> <test-file>...
//   exit 0 and a line for the commit body when the tests go red; exit 1 when they stay green.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

export function mutateText(text, find, replace) {
  const at = text.indexOf(find);
  if (at === -1) throw new Error("the text to find is not in the file");
  if (text.indexOf(find, at + 1) !== -1) throw new Error("the text to find occurs more than once; make it unique");
  return text.slice(0, at) + replace + text.slice(at + find.length);
}

function main([file, find, replace, ...tests]) {
  if (!file || find === undefined || replace === undefined || !tests.length) {
    throw new Error("usage: npm run mutate -- <file> <find> <replace> <test-file>...");
  }
  const path = join(ROOT, file);
  if (!existsSync(path)) throw new Error(`${file} not found`);
  const original = readFileSync(path, "utf8");
  const mutated = mutateText(original, find, replace);
  const restore = () => writeFileSync(path, original);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (restore(), process.exit(130)));
  let red;
  try {
    writeFileSync(path, mutated);
    red = spawnSync("npx", ["vitest", "run", ...tests, "--reporter=dot"], { cwd: ROOT, stdio: "ignore" }).status !== 0;
  } finally {
    restore();
  }
  const what = `\`${find}\` → \`${replace}\` in ${file}`;
  if (red) {
    console.log(`Mutation: ${what} turned ${tests.join(", ")} red; restored.`);
  } else {
    console.error(`NOT CAUGHT: ${what} left ${tests.join(", ")} green; restored. The guard does not test what it claims.`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

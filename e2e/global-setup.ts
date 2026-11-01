import { execFileSync } from "node:child_process";

export default function globalSetup() {
  execFileSync("npx", ["tsx", "e2e/seed-fixtures.ts"], { stdio: "inherit", env: process.env });
}

/**
 * Global test setup — loaded by vitest.config.ts before any test file.
 *
 * Keep this minimal. Shared fixtures belong in tests/utils/; a fixture used by
 * only one file belongs in that file (docs/TESTING.md).
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees between tests so one test's DOM cannot leak into the next.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Deterministic env for anything that reads config at import time. Real secrets
// never appear in tests; these are placeholders that satisfy presence checks.
process.env.NEXTAUTH_SECRET ??= "test-secret";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
process.env.ENCRYPTION_KEY ??=
  "0000000000000000000000000000000000000000000000000000000000000000";

// A test that reaches the network is a broken test — fail loudly rather than
// hanging or silently hitting a real service (docs/TESTING.md: never call a
// live external API from a test).
vi.stubGlobal(
  "fetch",
  vi.fn(() => {
    throw new Error(
      "Unmocked fetch in a test. Mock the client explicitly — tests must not make network calls."
    );
  })
);

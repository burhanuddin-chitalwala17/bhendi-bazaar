// Global setup, loaded before every test file. Keep minimal — fixtures go in
// tests/utils/ (docs/TESTING.md).
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Placeholders for config read at import time. Never real secrets.
process.env.NEXTAUTH_SECRET ??= "test-secret";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
process.env.ENCRYPTION_KEY ??=
  "0000000000000000000000000000000000000000000000000000000000000000";

// Fail loudly on network access; tests never call a live service.
vi.stubGlobal(
  "fetch",
  vi.fn(() => {
    throw new Error(
      "Unmocked fetch in a test. Mock the client explicitly — tests must not make network calls."
    );
  })
);

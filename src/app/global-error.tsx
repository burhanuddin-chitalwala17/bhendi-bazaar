"use client";

import "./globals.css";
import { PageError } from "@/components/shared/PageError";

// Replaces the root layout when the layout itself fails, so it brings its own document.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background px-4 text-foreground">
        <PageError reset={reset} digest={error.digest} />
      </body>
    </html>
  );
}

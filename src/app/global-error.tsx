"use client";

import "./globals.css";
import { PageError, digestOf } from "@/components/shared/PageError";

// Replaces the root layout when the layout itself fails, so it brings its own document.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background px-4 text-foreground">
        <PageError retry={retry} digest={digestOf(error)} />
      </body>
    </html>
  );
}

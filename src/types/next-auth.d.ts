// src/types/next-auth.d.ts

import "next-auth";
import type { PlatformRole } from "@prisma/client";

// The session shape is declared here and nowhere else. It was previously missing
// `platformRole`, which is why eight call sites reached for it through
// `(session.user as any)` — `any` at an authorization boundary, which CLAUDE.md
// calls a defect.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      platformRole: PlatformRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    platformRole: PlatformRole;
  }
}

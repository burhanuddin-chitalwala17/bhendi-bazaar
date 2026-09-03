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
      // Drives only the verification banner and the avatar badge — never access
      // control. Carried on the token so the chrome does not fetch /api/profile on
      // every page load; refreshed via session.update() after the user verifies.
      isEmailVerified: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    platformRole: PlatformRole;
    isEmailVerified: boolean;
  }
}

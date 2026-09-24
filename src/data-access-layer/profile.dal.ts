// src/data-access-layer/profile.dal.ts

import { cache } from "react";
import { getServerSession } from "next-auth";
import { unstable_rethrow } from "next/navigation";

import { authOptions } from "@/lib/auth-config";
import { profileService } from "@server/identity/profile.service";
import type { ProfileData } from "@/domain/profile";

export const profileDAL = {
  /**
   * The signed-in viewer's own profile, read on the server
   * ([ADR-0034](../../docs/adr/0034-render-on-the-server-by-default.md)).
   *
   * Session is read here rather than by the page, matching `orders.dal.ts` and
   * `wishlist.dal.ts`: the question is "whose profile", and plumbing a user id through the
   * page would only move the same read. `null` means a guest, which the page answers with a
   * sign-in prompt rather than an empty profile.
   */
  mine: cache(async (): Promise<ProfileData | null> => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) return null;
      return await profileService.getProfile(session.user.id);
    } catch (error) {
      // Reading the session marks the route dynamic by throwing; that is Next's control
      // flow, not a failure.
      unstable_rethrow(error);
      console.error("Failed to load profile:", error);
      return null;
    }
  }),
};

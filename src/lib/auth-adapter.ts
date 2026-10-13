import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { accountService } from "@server/identity/account.service";

/**
 * PrismaAdapter with `createUser` overridden.
 *
 * `User` has no `image` column — an avatar belongs to `Profile.profilePic` — but the
 * stock adapter passes `image` straight into `user.create`, which Prisma rejects with
 * "Unknown argument `image`", surfacing as `OAuthCreateAccount` on every new OAuth user.
 */
export function bhendiPrismaAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    createUser: async (data: Omit<AdapterUser, "id"> & { id?: string }) => {
      const { image, name, email } = data;

      // signIn() rejects any Google profile whose email_verified is not true, so
      // anything reaching createUser holds a provider-verified address.
      const user = await accountService.createVerifiedOAuthAccount({ name, email, image });

      return { ...user, image: image ?? null } as AdapterUser;
    },
  };
}

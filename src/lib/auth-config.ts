import type { NextAuthOptions } from "next-auth";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@server/shared/prisma";
import { bhendiPrismaAdapter } from "./auth-adapter";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: bhendiPrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Someone who signed up with a password and later clicks "Sign in with Google"
      // must land in the same account rather than hitting OAuthAccountNotLinked. Safe
      // only because signIn() below refuses any profile Google has not verified.
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash || user.isBlocked) {
          return null;
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    // Runs before NextAuth links or creates anything, so returning false here is what
    // makes allowDangerousEmailAccountLinking safe.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      // Without this, a Workspace admin could assert an address they do not own and
      // claim the matching password account.
      const google = profile as GoogleProfile | undefined;
      if (!google?.email || google.email_verified !== true) {
        return false;
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: google.email },
        select: { id: true, isBlocked: true, isEmailVerified: true },
      });

      if (!existingUser) {
        return true; // New user — the adapter creates it, already marked verified.
      }

      if (existingUser.isBlocked) {
        return false;
      }

      // They signed up with a password and never clicked the verification link, but
      // Google has now vouched for the same address.
      if (!existingUser.isEmailVerified) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { isEmailVerified: true, emailVerified: new Date() },
        });
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // Read once at sign-in. Acceptable because a platform role changes rarely and
        // its blast radius is the platform portal — unlike an org membership, which a
        // team page can revoke mid-session and so is read per request
        // (portal-separation trd.md D3). isEmailVerified rides the same query (no extra
        // op) so the chrome reads it from the session instead of fetching /api/profile.
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { platformRole: true, isEmailVerified: true },
        });
        token.platformRole = dbUser?.platformRole ?? "USER";
        token.isEmailVerified = dbUser?.isEmailVerified ?? false;
      } else if (trigger === "update") {
        // The user just verified their email (the banner calls session.update() on the
        // verification-success redirect). Re-read the one field that can flip mid-session.
        if (token.sub) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { isEmailVerified: true },
          });
          token.isEmailVerified = dbUser?.isEmailVerified ?? token.isEmailVerified ?? false;
        }
      } else if ((!token.platformRole || token.isEmailVerified === undefined) && token.sub) {
        // Migration shim: sessions minted before `role` became `platformRole` (PR-25)
        // carry no claim, which silently hid every admin affordance until the next
        // sign-in; likewise tokens minted before isEmailVerified rode the token. Stamp
        // both once from the database; removable when pre-2026-09 sessions have expired.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { platformRole: true, isEmailVerified: true },
        });
        token.platformRole = dbUser?.platformRole ?? "USER";
        token.isEmailVerified = dbUser?.isEmailVerified ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.platformRole = token.platformRole ?? "USER";
        session.user.isEmailVerified = token.isEmailVerified ?? false;
      }
      return session;
    },
  },
};



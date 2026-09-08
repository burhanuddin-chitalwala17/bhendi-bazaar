import { cache } from "react";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@server/shared/prisma";
import { UnauthorizedError, ForbiddenError } from "@server/shared/domain-error";

/**
 * The signed-in session, or a thrown failure.
 *
 * Throws rather than returning a `Session | NextResponse` union, which forced every
 * caller to discriminate with `instanceof NextResponse` and to accept a hand-rolled
 * error body. `toErrorResponse` turns these into the standard envelope
 * (ADR-0013), so the shape a client reads is the same everywhere.
 */
export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  return session;
}

/**
 * The session, having established that this person runs the platform.
 *
 * The role and the id both arrive as JWT claims minted at sign-in, so they outlive
 * the row they describe. Re-reading the row is what makes an admin id safe to use as
 * a foreign key: a deleted admin kept passing this check until `AdminLog.adminId`
 * rejected it, by which point the category write had already committed and the
 * failure was reported against an operation that had succeeded. It also revokes a
 * demoted or blocked admin now rather than at token expiry.
 *
 * One primary-key read per admin request. Memoised with React `cache()` (like
 * `requireOrgMember`) so the layout and the page it wraps share that one read within a
 * request rather than paying it twice — never across requests, so a demoted or blocked
 * admin is still revoked on their next request rather than at token expiry. In a route
 * handler `cache()` has no request scope to key on, so each handler still does its own
 * read; the dedupe is for the server-component render tree.
 */
async function resolvePlatformAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.platformRole !== "ADMIN") {
    throw new ForbiddenError("This area is restricted to platform administrators");
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true, isBlocked: true },
  });

  if (!admin) {
    throw new UnauthorizedError(
      "Your session is no longer valid. Sign out and sign in again."
    );
  }
  if (admin.isBlocked || admin.platformRole !== "ADMIN") {
    throw new ForbiddenError("This area is restricted to platform administrators");
  }

  return session;
}

export const requirePlatformAdmin = cache(resolvePlatformAdmin);

/** The signed-in user's id, having established they run the platform. */
export async function requirePlatformAdminId(): Promise<string> {
  const session = await requirePlatformAdmin();
  return session.user.id;
}

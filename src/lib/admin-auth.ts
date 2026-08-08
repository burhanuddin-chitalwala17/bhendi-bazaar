import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-config";
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

/** The session, having established that this person runs the platform. */
export async function requirePlatformAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.platformRole !== "ADMIN") {
    throw new ForbiddenError("This area is restricted to platform administrators");
  }
  return session;
}

/** The signed-in user's id, having established they run the platform. */
export async function requirePlatformAdminId(): Promise<string> {
  const session = await requirePlatformAdmin();
  return session.user.id;
}

/**
 * POST /api/channels/whatsapp/signup - what Meta's Embedded Signup pop-up returned
 *
 * The shop comes from the signed state, never the path; the signed-in person must be the one who
 * started, and still a member (connect-whatsapp R4). Answers an outcome code; no Meta text shows.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveOrgScope } from "@/lib/org-auth";
import { limitRequest } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-error-response";
import { whatsappSignupSchema, type WhatsAppSignupInput } from "@/lib/validation/schemas/whatsapp-signup.schema";
import { whatsappConnect } from "@server/channels/whatsapp-connect.service";
import { CONNECT_RESULT, type ConnectResult } from "@server/channels/channel-connection.types";

const answer = (result: ConnectResult) => NextResponse.json({ result });

export async function POST(request: NextRequest) {
  let body: WhatsAppSignupInput;
  try {
    body = whatsappSignupSchema.parse(await request.json());
  } catch (error) {
    return toErrorResponse(error, "That sign-up could not be read");
  }
  const check = whatsappConnect.readState(body.state);
  if (!check.ok) return answer(CONNECT_RESULT.EXPIRED);

  const { state } = check;
  try {
    const scope = await resolveOrgScope(state.orgId);
    if (scope.userId !== state.userId) return answer(CONNECT_RESULT.OTHER_SESSION);
  } catch {
    return answer(CONNECT_RESULT.OTHER_SESSION);
  }
  const limited = await limitRequest(request, "POST /api/channels/whatsapp/signup", { userId: state.userId });
  if (limited) return limited;

  try {
    return answer(await whatsappConnect.complete(state, body));
  } catch (error) {
    // Logged by kind only; a plan switched off mid-connect lands here too, as FeatureLockedError.
    console.error(JSON.stringify({ scope: "channels.whatsapp", step: "signup", error: (error as Error | null)?.name ?? "unknown" }));
    return answer(CONNECT_RESULT.UNREACHABLE);
  }
}

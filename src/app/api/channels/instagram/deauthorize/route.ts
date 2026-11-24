import { NextRequest, NextResponse } from "next/server";
import { metaCallbacksService } from "@server/channels/meta-callbacks.service";
import { callbackFailed, signedRequestOf } from "../../meta/meta-callback";

/** Instagram tells us a shop removed Bhendi Bazaar inside the app (meta-foundation R6, A3). */
export async function POST(req: NextRequest) {
  const signed = await signedRequestOf(req);
  if (!signed) return new NextResponse(null, { status: 400 });
  try {
    await metaCallbacksService.deauthorize(signed);
    return NextResponse.json({ received: true });
  } catch (error) {
    return callbackFailed(error);
  }
}

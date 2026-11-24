import { NextRequest, NextResponse } from "next/server";
import { metaCallbacksService } from "@server/channels/meta-callbacks.service";
import { callbackFailed, signedRequestOf } from "../meta-callback";

/** A person asked Meta that we delete what we hold about them (meta-foundation R7, A4). */
export async function POST(req: NextRequest) {
  const signed = await signedRequestOf(req);
  if (!signed) return new NextResponse(null, { status: 400 });
  try {
    return NextResponse.json(await metaCallbacksService.requestDeletion(signed));
  } catch (error) {
    return callbackFailed(error);
  }
}

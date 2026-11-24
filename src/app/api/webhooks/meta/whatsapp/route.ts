import type { NextRequest } from "next/server";
import { SOCIAL_PLATFORM } from "@server/channels/social/types";
import { metaWebhook } from "../meta-webhook";

const webhook = metaWebhook(SOCIAL_PLATFORM.WHATSAPP);

export async function GET(req: NextRequest) {
  return webhook.GET(req);
}

export async function POST(req: NextRequest) {
  return webhook.POST(req);
}

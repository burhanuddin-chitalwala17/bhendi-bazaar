import { shopfrontFeedXml } from "@/data-access-layer/shopfront-feed.dal";
import type { ShopfrontChannel } from "@server/listing/shopfront-feed";

/** Built on every fetch and never stored, so no cache can declare an offer after it ended (D1). */
export async function feedResponse(channel: ShopfrontChannel): Promise<Response> {
  return new Response(await shopfrontFeedXml(channel), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

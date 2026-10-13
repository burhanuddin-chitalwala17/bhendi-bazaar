/** GET /feeds/google.xml — fetched on a schedule by Google Merchant Center (shopfront-feeds). */

import { CHANNEL } from "@server/shared/channels";
import { feedResponse } from "../feed-response";

export const GET = () => feedResponse(CHANNEL.GOOGLE);

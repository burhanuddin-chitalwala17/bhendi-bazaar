/** GET /feeds/meta.xml — fetched on a schedule by Meta Commerce Manager (shopfront-feeds). */

import { CHANNEL } from "@server/shared/channels";
import { feedResponse } from "../feed-response";

export const GET = () => feedResponse(CHANNEL.META);

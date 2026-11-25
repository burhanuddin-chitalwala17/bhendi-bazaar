import { z } from "zod";
import { createGraphClient, type GraphClient } from "./graph-client";
import { metaAppId, metaAppSecret, signupConfigId } from "./settings";

/**
 * WhatsApp Embedded Signup's server half (connect-whatsapp D1, D2): the pop-up's code exchanged for
 * the business integration token, and what the pop-up said confirmed with Meta under that token.
 * Every call goes through the one Graph client.
 */

const TOKEN = z.object({ access_token: z.string().min(10) }).passthrough();
const PHONES = z.object({
  data: z.array(z.object({ id: z.union([z.string(), z.number()]).transform(String) }).passthrough()),
});

/** What the browser's SDK needs to open the pop-up; neither is a secret. */
export interface SignupSettings {
  appId: string;
  configId: string;
}

export function embeddedSignup(graph: GraphClient = createGraphClient()) {
  return {
    settings(): SignupSettings {
      return { appId: metaAppId(), configId: signupConfigId() };
    },

    /** The code is spent once at Meta; a lost answer cannot be asked for again, so it is a plain failure. */
    async exchange(code: string): Promise<string> {
      const { data } = await graph.call(
        {
          host: "facebook",
          method: "GET",
          path: "/oauth/access_token",
          step: "wa.exchange-code",
          query: { client_id: metaAppId(), client_secret: metaAppSecret(), code },
          mayHaveTakenEffect: false,
        },
        TOKEN,
      );
      return data.access_token;
    },

    /**
     * Whether the token reaches this phone number inside this WhatsApp account (R4): the page's ids
     * are only believed once Meta lists the one under the other for the token it just issued.
     */
    async owns(token: string, businessId: string, phoneId: string): Promise<boolean> {
      const { data } = await graph.call(
        {
          host: "facebook",
          method: "GET",
          path: `/${encodeURIComponent(businessId)}/phone_numbers`,
          step: "wa.read-phones",
          token,
          query: { fields: "id", limit: 100 },
        },
        PHONES,
      );
      return data.data.some((phone) => phone.id === phoneId);
    },
  };
}

export type EmbeddedSignup = ReturnType<typeof embeddedSignup>;

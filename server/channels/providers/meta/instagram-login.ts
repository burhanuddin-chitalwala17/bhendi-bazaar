import { z } from "zod";
import { createGraphClient, type GraphClient } from "./graph-client";
import { instagramAppId, instagramAppSecret } from "./settings";

/**
 * Instagram API with Instagram Login (connect-instagram D1, D2): the consent page, the code
 * exchanged for a short-lived and then a 60-day token, its refresh, the account read, and the
 * webhook subscription. Every call goes through the one Graph client.
 */

/** Exactly what the single review covers (connect-instagram Q2). */
export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

/** The webhook fields the inbox and automations read (connect-instagram D1). */
export const INSTAGRAM_FIELDS = ["comments", "messages", "messaging_postbacks", "message_edit", "messaging_seen", "message_reactions"] as const;

/** A long-lived Instagram Login token's life; Meta's "Long-lived access tokens" page, 2026-11-06 (Q6). */
export const INSTAGRAM_TOKEN_DAYS = 60;

export const INSTAGRAM_ACCOUNT = { BUSINESS: "business", CREATOR: "creator", PERSONAL: "personal" } as const;
export type InstagramAccountType = (typeof INSTAGRAM_ACCOUNT)[keyof typeof INSTAGRAM_ACCOUNT];

const SHORT_FLAT = z.object({ access_token: z.string().min(10), user_id: z.union([z.string(), z.number()]).transform(String) });
/** Meta's pages show the answer both flat and wrapped in `data[]`; either is read (verify on dev, A8). */
const SHORT = z.union([SHORT_FLAT, z.object({ data: z.array(SHORT_FLAT).min(1) }).transform((wrapped) => wrapped.data[0])]);
const LONG = z.object({ access_token: z.string().min(10), expires_in: z.number().int().positive() });
const ME = z.object({
  user_id: z.union([z.string(), z.number()]).transform(String),
  username: z.string().min(1).max(64),
  account_type: z.string().optional(),
});
const OK = z.object({ success: z.boolean() }).passthrough();

export interface InstagramGrant {
  accessToken: string;
  expiresAt: Date;
}

export interface InstagramAccount {
  /** The professional account's id: what webhooks and the deauthorize callback name. */
  accountId: string;
  username: string;
  type: InstagramAccountType;
}

function accountType(raw: string | undefined): InstagramAccountType {
  switch ((raw ?? "").toUpperCase()) {
    case "BUSINESS":
      return INSTAGRAM_ACCOUNT.BUSINESS;
    case "MEDIA_CREATOR":
    case "CREATOR":
      return INSTAGRAM_ACCOUNT.CREATOR;
    default:
      return INSTAGRAM_ACCOUNT.PERSONAL;
  }
}

export function instagramLogin(graph: GraphClient = createGraphClient({ appSecret: instagramAppSecret })) {
  const long = (token: string, step: string, grantType: string, now: Date) =>
    graph
      .call(
        {
          host: "instagramGraphUnversioned",
          method: "GET",
          path: grantType === "ig_exchange_token" ? "/access_token" : "/refresh_access_token",
          step,
          token,
          query: grantType === "ig_exchange_token" ? { grant_type: grantType, client_secret: instagramAppSecret() } : { grant_type: grantType },
          mayHaveTakenEffect: false,
        },
        LONG,
      )
      .then(({ data }) => ({ accessToken: data.access_token, expiresAt: new Date(now.getTime() + data.expires_in * 1000) }));

  return {
    consentUrl(state: string, redirectUri: string): string {
      const url = new URL("https://www.instagram.com/oauth/authorize");
      url.searchParams.set("client_id", instagramAppId());
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
      url.searchParams.set("state", state);
      return url.toString();
    },

    /** Instagram appends `#_` to the code; a refusal comes back as `error`. */
    readReturn(params: URLSearchParams): { code: string | null; state: string | null; declined: boolean } {
      const code = params.get("code")?.replace(/#_$/, "") || null;
      return { code, state: params.get("state"), declined: params.has("error") };
    },

    /** The code for a short-lived token, then that for the 60-day one. */
    async exchange(code: string, redirectUri: string, now = new Date()): Promise<InstagramGrant> {
      const { data: short } = await graph.call(
        {
          host: "instagramOauth",
          method: "POST",
          path: "/oauth/access_token",
          step: "ig.exchange-code",
          form: true,
          body: { client_id: instagramAppId(), client_secret: instagramAppSecret(), grant_type: "authorization_code", redirect_uri: redirectUri, code },
          // A code is spent once; a lost answer cannot be asked for again, so it is a plain failure.
          mayHaveTakenEffect: false,
        },
        SHORT,
      );
      return long(short.access_token, "ig.long-lived-token", "ig_exchange_token", now);
    },

    /** Any time after 24 hours while the token is valid (connect-instagram D2). */
    async refresh(token: string, now = new Date()): Promise<InstagramGrant> {
      return long(token, "ig.refresh-token", "ig_refresh_token", now);
    },

    async account(token: string): Promise<InstagramAccount> {
      const { data } = await graph.call({ host: "instagram", method: "GET", path: "/me", step: "ig.read-account", token, query: { fields: "user_id,username,account_type" } }, ME);
      return { accountId: data.user_id, username: data.username, type: accountType(data.account_type) };
    },

    /** Idempotent on Meta's side: subscribing again changes nothing. */
    async subscribe(token: string): Promise<void> {
      await graph.call(
        { host: "instagram", method: "POST", path: "/me/subscribed_apps", step: "ig.subscribe", token, query: { subscribed_fields: INSTAGRAM_FIELDS.join(",") }, mayHaveTakenEffect: false },
        OK,
      );
    },

    async unsubscribe(token: string): Promise<void> {
      await graph.call({ host: "instagram", method: "DELETE", path: "/me/subscribed_apps", step: "ig.unsubscribe", token, mayHaveTakenEffect: false }, OK);
    },
  };
}

export type InstagramLogin = ReturnType<typeof instagramLogin>;

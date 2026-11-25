import { WHATSAPP_NUMBER_KIND, type WhatsAppNumberKind } from "@server/channels/channel-connection.types";

/**
 * Meta's JS SDK, loaded only when a shop taps Connect WhatsApp (connect-whatsapp D1), and the
 * session-info message its Embedded Signup posts back. The CSP admits the SDK's host
 * (src/lib/security-headers.ts); the nonce is set too, so the tag is ours either way.
 */

const SDK_URL = "https://connect.facebook.net/en_US/sdk.js";
const SCRIPT_ID = "meta-sdk-js";
/** Meta's Graph version the SDK speaks; the server's client pins its own (graph-client.ts). */
const SDK_VERSION = "v26.0";

interface LoginResponse {
  authResponse?: { code?: string } | null;
}

declare global {
  interface Window {
    FB?: {
      init(options: Record<string, unknown>): void;
      login(callback: (response: LoginResponse) => void, options: Record<string, unknown>): void;
    };
    fbAsyncInit?: () => void;
  }
}

let loading: Promise<NonNullable<Window["FB"]>> | null = null;

/** A script that loads but never initialises (a blocker, a partial load) must not leave the button pending. */
const LOAD_TIMEOUT_MS = 15_000;

export function loadMetaSdk(appId: string, nonce?: string): Promise<NonNullable<Window["FB"]>> {
  if (window.FB) return Promise.resolve(window.FB);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const fail = () => {
      clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new Error("Meta's SDK did not load"));
    };
    const timer = setTimeout(fail, LOAD_TIMEOUT_MS);
    window.fbAsyncInit = () => {
      clearTimeout(timer);
      window.FB!.init({ appId, autoLogAppEvents: false, xfbml: false, version: SDK_VERSION });
      // From here `window.FB` answers; the pending promise is only for loads in flight.
      loading = null;
      resolve(window.FB!);
    };
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SDK_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    if (nonce) script.nonce = nonce;
    script.onerror = fail;
    document.body.appendChild(script);
  });
  return loading;
}

/** Opens Embedded Signup; answers the code, or null when the pop-up was closed. */
export function openEmbeddedSignup(
  fb: NonNullable<Window["FB"]>,
  options: { configId: string; prefill?: { name?: string; email?: string; website?: string } },
): Promise<string | null> {
  return new Promise((resolve) => {
    fb.login((response) => resolve(response.authResponse?.code ?? null), {
      config_id: options.configId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: options.prefill ? { business: options.prefill } : {},
        // Coexistence first, so the Business app keeps working (R2); Meta offers a new number where it cannot (R3).
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3",
      },
    });
  });
}

export interface SessionInfo {
  businessId: string;
  phoneId: string;
  kind: WhatsAppNumberKind;
}

/** Only these finish with a number; FINISH_ONLY_WABA made an account with none, so nothing connects. */
const FINISHED: Record<string, WhatsAppNumberKind> = {
  FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING: WHATSAPP_NUMBER_KIND.COEXISTENCE,
  FINISH: WHATSAPP_NUMBER_KIND.CLOUD,
};

/**
 * The pop-up's session-info message: its ids, `"cancelled"` when it closed, or null for any other
 * message. Its origin is checked here; its ids are confirmed with Meta by the server (R4).
 */
export function readSessionInfo(event: MessageEvent): SessionInfo | "cancelled" | null {
  let host: string;
  try {
    host = new URL(event.origin).hostname;
  } catch {
    return null;
  }
  if (host !== "facebook.com" && !host.endsWith(".facebook.com")) return null;
  let message: unknown;
  try {
    message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    return null;
  }
  const info = message as { type?: unknown; event?: unknown; data?: { phone_number_id?: unknown; waba_id?: unknown } } | null;
  if (!info || info.type !== "WA_EMBEDDED_SIGNUP") return null;
  if (info.event === "CANCEL") return "cancelled";
  const kind = typeof info.event === "string" ? FINISHED[info.event] : undefined;
  const phoneId = info.data?.phone_number_id;
  const businessId = info.data?.waba_id;
  if (!kind || typeof phoneId !== "string" || typeof businessId !== "string") return "cancelled";
  return { businessId, phoneId, kind };
}

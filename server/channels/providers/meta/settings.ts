import { z } from "zod";

/** The Meta app's settings, read only here; each is checked on its own (meta-foundation D1, D12, Q5). */

const APP_ID = z.string().regex(/^\d{5,20}$/);
const SECRET = z.string().min(16);

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** One setting, or an error naming it — never its value, which may be a secret. */
function required<T>(name: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(env(name));
  if (!parsed.success) throw new Error(`Meta setting ${name} is missing or malformed`);
  return parsed.data;
}

function optional<T>(name: string, schema: z.ZodType<T>): T | undefined {
  const value = env(name);
  if (value === undefined) return undefined;
  return required(name, schema);
}

/** The Meta app (WhatsApp, catalogues, Embedded Signup). */
export const metaAppId = () => required("META_APP_ID", APP_ID);
export const metaAppSecret = () => required("META_APP_SECRET", SECRET);
/** Instagram API with Instagram Login has its own app id and secret in the same Meta app. */
export const instagramAppId = () => required("META_INSTAGRAM_APP_ID", APP_ID);
export const instagramAppSecret = () => required("META_INSTAGRAM_APP_SECRET", SECRET);
export const webhookVerifyToken = () => required("META_WEBHOOK_VERIFY_TOKEN", SECRET);
export const signupConfigId = () => required("META_SIGNUP_CONFIG_ID", APP_ID);

export type MetaProduct = "instagram" | "whatsapp";

/** Every secret a signature from this product may be checked against, the current one first (D12). */
export function signingSecrets(product: MetaProduct): string[] {
  const [current, previous] =
    product === "instagram"
      ? [instagramAppSecret(), optional("META_INSTAGRAM_APP_SECRET_PREVIOUS", SECRET)]
      : [metaAppSecret(), optional("META_APP_SECRET_PREVIOUS", SECRET)];
  return previous ? [current, previous] : [current];
}

/** Whether this deployment can act for a product at all. Never throws. */
export function metaConfigured(product: MetaProduct): boolean {
  try {
    webhookVerifyToken();
    if (product === "instagram") {
      instagramAppId();
      instagramAppSecret();
    } else {
      metaAppId();
      metaAppSecret();
      signupConfigId();
    }
    return true;
  } catch {
    return false;
  }
}

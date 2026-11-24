import { createHmac } from "node:crypto";
import { z, type ZodType } from "zod";
import { SOCIAL_ERROR } from "../../social/types";
import { classifyMetaError, classifyNetworkFailure, MetaError, MetaShapeError, type MetaErrorBody } from "./errors";
import { metaAppSecret } from "./settings";

/** The one client every Meta call goes through (social-selling TRD A-D4; meta-foundation D2, D11). */

/** Pinned; an upgrade is a reviewed change with Meta's changelog read (v26.0 released 2026-07-29). */
export const META_GRAPH_VERSION = "v26.0";

const HOSTS = {
  /** WhatsApp, catalogues, Facebook Login and Embedded Signup. */
  facebook: `https://graph.facebook.com/${META_GRAPH_VERSION}`,
  /** Instagram API with Instagram Login. */
  instagram: `https://graph.instagram.com/${META_GRAPH_VERSION}`,
  /** Instagram Login's unversioned token endpoints. */
  instagramOauth: "https://api.instagram.com",
  instagramGraphUnversioned: "https://graph.instagram.com",
} as const;
export type GraphHost = keyof typeof HOSTS;

const TIMEOUT_MS = 10_000;

/** Who a call is for, for the log line (A-D20). Ids only. */
export interface GraphContext {
  orgId?: string;
  connectionId?: string;
  lane?: string;
}

export interface GraphRequest {
  host: GraphHost;
  method: "GET" | "POST" | "DELETE";
  /** Starts with "/". Ids are not secrets; a token never goes in a path or query. */
  path: string;
  /** Names the call in logs and errors, e.g. "wa.send-message". Never ids or text. */
  step: string;
  token?: string;
  query?: Record<string, string | number | boolean | undefined>;
  /** Sent as JSON, or form-encoded when `form` is true (Meta's OAuth endpoints). */
  body?: Record<string, unknown>;
  form?: boolean;
  /** A call that changes something on Meta; defaults to true for POST and DELETE (ADR-0086). */
  mayHaveTakenEffect?: boolean;
  context?: GraphContext;
}

/** How close the app and the account are to Meta's limits, 0–1, and seconds to the reset. */
export interface GraphUsage {
  pressure: number;
  resetSeconds: number | null;
}

export interface GraphResponse<T> {
  data: T;
  usage: GraphUsage;
}

export type GraphTransport = (url: string, init: RequestInit) => Promise<Response>;

const defaultTransport: GraphTransport = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });

/** HMAC-SHA256 of the token under the app secret, as Meta's "Require app secret" expects. */
export function appSecretProof(token: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(token).digest("hex");
}

const ERROR_ENVELOPE = z.object({
  error: z.object({ code: z.number().optional(), error_subcode: z.number().optional(), message: z.string().optional() }).passthrough(),
});

const USAGE_ENTRY = z
  .object({
    call_count: z.number().optional(),
    total_cputime: z.number().optional(),
    total_time: z.number().optional(),
    estimated_time_to_regain_access: z.number().optional(),
  })
  .passthrough();

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** `X-App-Usage`, `X-Business-Use-Case-Usage` (percents; regain time in minutes) and `Retry-After`, each read on its own. */
export function readUsage(headers: Headers): GraphUsage {
  let percent = 0;
  let resetSeconds: number | null = null;
  const take = (entry: z.infer<typeof USAGE_ENTRY>) => {
    percent = Math.max(percent, entry.call_count ?? 0, entry.total_cputime ?? 0, entry.total_time ?? 0);
    if (entry.estimated_time_to_regain_access) {
      resetSeconds = Math.max(resetSeconds ?? 0, entry.estimated_time_to_regain_access * 60);
    }
  };
  const app = USAGE_ENTRY.safeParse(parseJson(headers.get("x-app-usage")));
  if (app.success) take(app.data);
  const business = z.record(z.string(), z.array(USAGE_ENTRY)).safeParse(parseJson(headers.get("x-business-use-case-usage")));
  if (business.success) for (const entries of Object.values(business.data)) entries.forEach(take);
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) resetSeconds = Math.max(resetSeconds ?? 0, retryAfter);
  return { pressure: Math.min(percent, 100) / 100, resetSeconds };
}

function buildUrl(request: GraphRequest, appSecret: () => string): string {
  const url = new URL(HOSTS[request.host] + request.path);
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (key === "access_token" || key === "appsecret_proof") throw new Error(`${key} may not be passed in a Graph query`);
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  // Only the Facebook Graph checks the Meta app's proof; Instagram Login tokens belong to the Instagram app (Q5).
  if (request.token && request.host === "facebook") url.searchParams.set("appsecret_proof", appSecretProof(request.token, appSecret()));
  return url.toString();
}

function log(request: GraphRequest, status: number | null, ms: number, code: string | null, metaCode: number | null) {
  const { orgId, connectionId, lane } = request.context ?? {};
  console.info(
    JSON.stringify({ scope: "meta.graph", step: request.step, method: request.method, orgId, connectionId, lane, status, ms, code, metaCode }),
  );
}

export interface GraphClient {
  call<T>(request: GraphRequest, schema: ZodType<T>): Promise<GraphResponse<T>>;
}

export function createGraphClient(options: { transport?: GraphTransport; appSecret?: () => string } = {}): GraphClient {
  const transport = options.transport ?? defaultTransport;
  const appSecret = options.appSecret ?? metaAppSecret;

  return {
    async call<T>(request: GraphRequest, schema: ZodType<T>): Promise<GraphResponse<T>> {
      const mayHaveTakenEffect = request.mayHaveTakenEffect ?? request.method !== "GET";
      const headers: Record<string, string> = { Accept: "application/json" };
      if (request.token) headers.Authorization = `Bearer ${request.token}`;
      let body: string | undefined;
      if (request.body) {
        if (request.form) {
          headers["Content-Type"] = "application/x-www-form-urlencoded";
          body = new URLSearchParams(
            Object.entries(request.body).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
          ).toString();
        } else {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(request.body);
        }
      }

      const started = Date.now();
      const url = buildUrl(request, appSecret);
      let response: Response;
      let raw: string;
      try {
        response = await transport(url, { method: request.method, headers, body });
        raw = await response.text();
      } catch (error) {
        const failure = classifyNetworkFailure(error, request.step, mayHaveTakenEffect);
        log(request, null, Date.now() - started, failure.code, null);
        throw failure;
      }

      const usage = readUsage(response.headers);
      const json = parseJson(raw);

      if (!response.ok) {
        const envelope = ERROR_ENVELOPE.safeParse(json);
        const errorBody: MetaErrorBody | null = envelope.success ? envelope.data.error : null;
        const failure = classifyMetaError(response.status, errorBody, request.step, mayHaveTakenEffect, usage.resetSeconds);
        log(request, response.status, Date.now() - started, failure.code, failure.metaCode);
        throw failure;
      }

      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        // A send Meta accepted but answered strangely did go out: never let it look failed (ADR-0086).
        log(request, response.status, Date.now() - started, mayHaveTakenEffect ? SOCIAL_ERROR.UNCERTAIN : "shape", null);
        throw mayHaveTakenEffect ? new MetaError(SOCIAL_ERROR.UNCERTAIN, request.step) : new MetaShapeError(request.step);
      }
      log(request, response.status, Date.now() - started, null, null);
      return { data: parsed.data, usage };
    },
  };
}

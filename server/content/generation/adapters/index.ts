import { ADAPTER, type AdapterKey } from "@server/content/generation/registry";
import type { Adapter } from "@server/content/generation/adapters/adapter";
import { gatewayAdapter } from "@server/content/generation/adapters/gateway";
import { geminiAdapter } from "@server/content/generation/adapters/gemini";
import { falAdapter } from "@server/content/generation/adapters/fal";

/** Every provider API the platform can speak; a new one is a file and a line here (trd D2). */
export const ADAPTERS: Record<AdapterKey, Adapter> = {
  [ADAPTER.GATEWAY]: gatewayAdapter,
  [ADAPTER.GEMINI]: geminiAdapter,
  [ADAPTER.FAL]: falAdapter,
};

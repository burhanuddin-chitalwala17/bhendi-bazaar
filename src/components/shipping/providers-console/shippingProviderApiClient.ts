import { apiRequest } from "@/lib/api-client";
import type {
  GetProvidersResponse,
  ConnectionRequestBody,
  ConnectionResponse,
} from "@/components/shipping/providers-console/types";
import { PROVIDERS_API_COPY } from "@/components/shipping/providers-console/providers-console-copy";

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** The providers console. A failure resolves to `success: false` rather than throwing. */
export const shippingProviderApiClient = {
  async getProviders(): Promise<GetProvidersResponse> {
    try {
      return await apiRequest<GetProvidersResponse>("/api/admin/shipping/providers", { cache: "no-store" });
    } catch (error) {
      console.error("shippingProviderApiClient.getProviders error:", error);
      return { success: false, providers: [], error: message(error, PROVIDERS_API_COPY.fetchFailed) };
    }
  },

  async connectProvider(providerId: string, requestBody: ConnectionRequestBody): Promise<ConnectionResponse> {
    try {
      return await apiRequest<ConnectionResponse>(`/api/admin/shipping/providers/${providerId}/connect`, {
        method: "POST",
        body: requestBody,
      });
    } catch (error) {
      console.error("shippingProviderApiClient.connectProvider error:", error);
      return { success: false, error: message(error, PROVIDERS_API_COPY.connectFailed) };
    }
  },

  async disconnectProvider(providerId: string): Promise<ConnectionResponse> {
    try {
      return await apiRequest<ConnectionResponse>(`/api/admin/shipping/providers/${providerId}/disconnect`, {
        method: "POST",
      });
    } catch (error) {
      console.error("shippingProviderApiClient.disconnectProvider error:", error);
      return { success: false, error: message(error, PROVIDERS_API_COPY.disconnectFailed) };
    }
  },
};

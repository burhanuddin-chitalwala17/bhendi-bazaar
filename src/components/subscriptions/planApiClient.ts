import { apiRequest } from "@/lib/api-client";
import type { Feature, FeatureSwitchDTO } from "@server/subscriptions/feature-access.types";

/** The admin's switch for one paid feature of one shop (subscriptions/feature-access D12). */
export const planApiClient = {
  async setFeature(orgId: string, feature: Feature, enabled: boolean): Promise<FeatureSwitchDTO> {
    const { switch: row } = await apiRequest<{ switch: FeatureSwitchDTO }>(`/api/admin/orgs/${orgId}/features/${feature}`, {
      method: "PUT",
      body: { enabled },
    });
    return row;
  },
};

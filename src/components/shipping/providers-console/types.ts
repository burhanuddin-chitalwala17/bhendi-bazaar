// Define client-side types (don't import from /server)
export interface ShippingProvider {
  id: string;
  code: string;
  name: string;
  connectionType: "email_password" | "api_key" | "oauth";
  description?: string;
  isConnected: boolean;
  paymentOptions?: string[];
  deliveryModes?: string[];
  logoUrl?: string;
  websiteUrl?: string;
  accountInfo?: Record<string, string | number>;
  lastAuthAt?: Date;
  connectedBy?: string;
}

export interface ConnectionRequestBody {
  type: "email_password" | "api_key" | "oauth";
  email?: string;
  password?: string;
}

export interface ConnectionResponse {
  success: boolean;
  provider?: ShippingProvider;
  error?: string;
}

export interface GetProvidersResponse {
  success: boolean;
  providers: ShippingProvider[];
  error?: string;
}

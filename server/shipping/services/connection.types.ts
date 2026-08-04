export interface AdminConnectionResult {
  success: boolean;
  error?: string;
  tokenExpiresAt?: Date;
  lastAuthAt?: Date;
  connectedBy?: string;
  accountInfo?: Record<string, string | number>;
}

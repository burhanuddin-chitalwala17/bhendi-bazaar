/** What the console learns from connecting a carrier. No token, and no password beside the email. */
export interface AdminConnectionResult {
  success: boolean;
  error?: string;
  lastAuthAt?: Date;
  connectedBy?: string;
  accountInfo?: Record<string, string | number>;
}

import { AuthPageHost } from "@/components/auth/auth-page-host";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  return <AuthPageHost view="forgot" callbackUrl={safeCallbackUrl(callbackUrl)} />;
}

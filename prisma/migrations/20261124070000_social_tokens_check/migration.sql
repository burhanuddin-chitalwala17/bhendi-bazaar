-- social-selling connect-instagram unit 1 (D1): a social connection holds one long-lived access
-- token and no refresh token (Instagram Login's 60-day token; WhatsApp's system-user token), so a
-- live social row needs its access token; a live marketplace row still needs its refresh token.
ALTER TABLE "ChannelConnection" DROP CONSTRAINT "ChannelConnection_tokens_check";
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_tokens_check" CHECK (
    ("state" = 'DISCONNECTED' AND "accessToken" IS NULL AND "refreshToken" IS NULL)
    OR ("state" <> 'DISCONNECTED' AND "channel" IN ('instagram', 'whatsapp') AND "accessToken" IS NOT NULL)
    OR ("state" <> 'DISCONNECTED' AND "channel" NOT IN ('instagram', 'whatsapp') AND "refreshToken" IS NOT NULL)
);

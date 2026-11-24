-- social-selling connect-instagram unit 1 (D1): a social connection holds one long-lived access
-- token and no refresh token (Instagram Login's 60-day token; WhatsApp's system-user token), so a
-- live row needs either token rather than a refresh token. A disconnected row still holds neither.
ALTER TABLE "ChannelConnection" DROP CONSTRAINT "ChannelConnection_tokens_check";
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_tokens_check" CHECK (
    ("state" = 'DISCONNECTED' AND "accessToken" IS NULL AND "refreshToken" IS NULL)
    OR ("state" <> 'DISCONNECTED' AND ("refreshToken" IS NOT NULL OR "accessToken" IS NOT NULL))
);

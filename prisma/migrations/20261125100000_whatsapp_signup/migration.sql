-- social-selling connect-whatsapp unit 1 (D1, D2): a WhatsApp number is set up in the background after
-- Meta's pop-up, so a connection may be SETTING_UP or SETUP_FAILED; and the one live sign-up attempt's
-- nonce is kept on the shop's row, so a pop-up result is spent once (A3). No data is dropped.
ALTER TABLE "ChannelConnection" DROP CONSTRAINT "ChannelConnection_state_check";
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_state_check"
    CHECK ("state" IN ('CONNECTED', 'NEEDS_RECONNECT', 'DISCONNECTED', 'SETTING_UP', 'SETUP_FAILED'));
ALTER TABLE "ChannelConnection" ADD COLUMN "signupNonce" TEXT;

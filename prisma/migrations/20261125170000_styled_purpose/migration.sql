-- ai-images/social-posts unit 1 (D1): which purpose a styled run was asked for. Nullable, null is a
-- listing picture, so every existing run keeps its meaning; nothing dropped. The closed set is
-- STYLED_PURPOSE in server/content/enhancement.types.ts, pinned here.
ALTER TABLE "Enhancement" ADD COLUMN "purpose" TEXT;
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_purpose_check" CHECK ("purpose" IS NULL OR "purpose" IN ('listing', 'social'));

-- social-selling/post-composer unit 1 (D1): a shop's post and its destinations. New tables; nothing
-- dropped. States and kinds are closed sets in server/social/post.types.ts, pinned here by CHECKs.
-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "caption" TEXT NOT NULL DEFAULT '',
    "mediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostDestination" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "platformId" TEXT,
    "permalink" TEXT,
    "errorCode" TEXT,
    "errorText" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDestination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_orgId_state_scheduledAt_idx" ON "Post"("orgId", "state", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostDestination_postId_kind_key" ON "PostDestination"("postId", "kind");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDestination" ADD CONSTRAINT "PostDestination_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A post names at most 10 pictures and 10 products (spec R2, R6); the service refuses first.
ALTER TABLE "Post" ADD CONSTRAINT "Post_mediaIds_max" CHECK (cardinality("mediaIds") <= 10);
ALTER TABLE "Post" ADD CONSTRAINT "Post_productIds_max" CHECK (cardinality("productIds") <= 10);
ALTER TABLE "Post" ADD CONSTRAINT "Post_state_known"
    CHECK ("state" IN ('DRAFT', 'SCHEDULED', 'SAVED', 'PUBLISHING', 'DONE', 'CANCELLED'));
ALTER TABLE "PostDestination" ADD CONSTRAINT "PostDestination_kind_known"
    CHECK ("kind" IN ('IG_FEED', 'IG_STORY', 'WA_STATUS'));

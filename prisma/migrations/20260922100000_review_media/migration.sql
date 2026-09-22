-- A review can carry the buyer's own photographs, and a link to a video they had
-- already published (review-media R1, R5).
--
-- Its own table, not a column on ProductMedia: every gallery, cover and thumbnail query
-- reads that one, and a review's picture there would be one forgotten WHERE away from
-- becoming the product's own (review-media trd.md D1).
CREATE TABLE "ReviewMedia" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "ref" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReviewMedia_reviewId_idx" ON "ReviewMedia"("reviewId");

-- Cascade: a review's media carries no money and no attribution, which is the case
-- ADR-0020 leaves cascading. The objects in R2 are deleted by the service.
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/** The marketplace Home's own words, around the shared sections it renders (ADR-0067). */
export const HOME_PAGE_COPY = {
  offersMore: "View more",
  newTitle: "New this week",
  newDescription: "Fresh from the shops of the bazaar",
  seeAll: "See all",
  seeAllCount: (count: string) => `See all ${count}`,
} as const;

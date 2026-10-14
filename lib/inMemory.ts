/**
 * The in-memory rule. Someone in memory has no forward-looking or contact features: no mailing address, no
 * "Coming up", and they're left out of upcoming lists, calendar feeds, and reminders. Their birthday and
 * anniversary still show on their own page as plain dates, and remembrance days still work.
 * Use these everywhere so new features follow the rule automatically.
 */
export const isInMemory = (p: { inMemory?: boolean | null; in_memory?: boolean | null } | null | undefined) =>
  !!(p && (p.inMemory ?? p.in_memory));

/** SQL: this person is still with us. `alias` is the people table's alias in the query. */
export const livingSql = (alias = "pe") => `not coalesce(${alias}.in_memory, false)`;

/**
 * Who belongs in upcoming lists, calendar feeds, and reminders: family still with us. Someone in memory is left
 * out, and so is a co-parent (on the tree for the children's sake, but not family).
 */
export const inUpcoming = (p: { inMemory?: boolean | null; in_memory?: boolean | null; coparent?: boolean | null; is_coparent?: boolean | null }) =>
  !isInMemory(p) && !(p.coparent ?? p.is_coparent);

/** SQL version of inUpcoming. `alias` is the people table's alias in the query. */
export const upcomingSql = (alias = "pe") => `${livingSql(alias)} and not coalesce(${alias}.is_coparent, false)`;

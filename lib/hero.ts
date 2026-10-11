const SEASONS: Record<string, number[]> = { Winter: [12, 1, 2], Spring: [3, 4, 5], Summer: [6, 7, 8], Autumn: [9, 10, 11] };

/** The months in a season, for "Summers past" style filters. */
export const seasonMonths = (name: string) => SEASONS[name];

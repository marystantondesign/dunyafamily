import { q } from "./db";
import { countPhotos, findPhotos, type Filters } from "./photos";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SEASONS: Record<string, number[]> = { Winter: [12, 1, 2], Spring: [3, 4, 5], Summer: [6, 7, 8], Autumn: [9, 10, 11] };

function thanksgiving(y: number) {
  const first = new Date(y, 10, 1);
  return new Date(y, 10, 1 + ((4 - first.getDay() + 7) % 7) + 21);
}

function holidays(year: number) {
  return [year, year + 1].flatMap((y) => [
    { name: "Halloween", title: "Halloweens past", date: new Date(y, 9, 31) },
    { name: "Thanksgiving", title: "Thanksgivings past", date: thanksgiving(y) },
    { name: "Christmas", title: "Christmases past", date: new Date(y, 11, 25) },
    { name: "New Year's", title: "New Years past", date: new Date(y, 0, 1) },
    { name: "Fourth of July", title: "Fourths of July past", date: new Date(y, 6, 4) },
  ]);
}

export type Hero = { title: string; href: string; filters: Filters };

const MIN = 4;
const HOLIDAY_WINDOW_DAYS = 21;

/**
 * Picks what the homepage leads with:
 * 1. A holiday in the next three weeks, if it has photos
 * 2. This month in past years (needs photos with a known month)
 * 3. This season (by month, or tagged with the season)
 * 4. A random handful from the archive
 */
export async function pickHero(now = new Date()): Promise<Hero> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const occasions = await q<{ id: number; name: string }>(`select id, name from occasions`);
  const idOf = (name: string) => occasions.find((o) => o.name.toLowerCase() === name.toLowerCase())?.id;

  const soon = holidays(today.getFullYear())
    .map((h) => ({ ...h, days: (h.date.getTime() - today.getTime()) / 86_400_000 }))
    .filter((h) => h.days >= 0 && h.days <= HOLIDAY_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days);
  for (const h of soon) {
    const id = idOf(h.name);
    if (id && (await countPhotos({ occasions: [id] })) >= MIN)
      return { title: h.title, href: `/browse?occasions=${id}`, filters: { occasions: [id] } };
  }

  const m = today.getMonth() + 1;
  if ((await countPhotos({ months: [m] })) >= MIN)
    return { title: `${MONTHS[m - 1]}s past`, href: `/browse?month=${m}`, filters: { months: [m] } };

  const [season, months] = Object.entries(SEASONS).find(([, ms]) => ms.includes(m))!;
  const seasonFilter: Filters = { season: { months, occasionId: idOf(season) } };
  if ((await countPhotos(seasonFilter)) >= 1)
    return { title: `${season}s past`, href: `/browse?season=${season}`, filters: seasonFilter };

  return { title: "From the archive", href: "/browse", filters: {} };
}

export async function heroPhotos(hero: Hero) {
  // A random sample, then shown oldest to newest so it reads as a walk through the years.
  const sample = await findPhotos(hero.filters, { order: "random", limit: 8 });
  return sample.sort((a, b) => (a.year ?? a.decade ?? 9999) - (b.year ?? b.decade ?? 9999));
}

export const seasonMonths = (name: string) => SEASONS[name];

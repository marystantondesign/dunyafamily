/**
 * Names as they're shown: "mary" shows as "Mary", "aunt rose" as "Aunt Rose". Only lowercase first letters change,
 * so "McKay" stays "McKay". Stored names are left as they are.
 */
export const displayName = (name: string) => name.replace(/(^|[\s-])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/** For "added by" names, which can be missing on older rows. */
export const byName = (name: string | null | undefined, fallback = "someone") => (name?.trim() ? displayName(name.trim()) : fallback);

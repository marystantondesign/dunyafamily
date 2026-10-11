import { cookies } from "next/headers";

/** The shuffle seed for this visit. Middleware sets it once per browser session; "Shuffle again" replaces it. */
export const SHUFFLE_COOKIE = "df_shuffle";

export async function shuffleSeed() {
  return (await cookies()).get(SHUFFLE_COOKIE)?.value ?? "0";
}

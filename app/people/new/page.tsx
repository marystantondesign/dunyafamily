import { AddPersonForm } from "@/components/AddPersonForm";
import { listPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

/** ?childOf=12 (or parentOf, partnerOf) starts with that relationship chosen. */
export default async function NewPersonPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [people, sp] = await Promise.all([listPeople(), searchParams]);
  const pick = (["childOf", "parentOf", "partnerOf"] as const).find((k) => Number(sp[k]));
  const start = pick ? { kind: pick.replace("Of", "") as "child" | "parent" | "partner", other: Number(sp[pick]) } : undefined;
  return <AddPersonForm people={people.map(({ id, name, aliases }) => ({ id, name, aliases }))} start={start && people.some((p) => p.id === start.other) ? start : undefined} />;
}

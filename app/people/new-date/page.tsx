import { AddDateForm } from "@/components/AddDateForm";
import { listPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewDatePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const people = await listPeople();
  return (
    <AddDateForm
      people={people.map(({ id, name, aliases }) => ({ id, name, aliases }))}
      kind={kind === "remembrance" || kind === "other" ? kind : "anniversary"}
    />
  );
}

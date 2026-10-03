import { EnterForm } from "@/components/EnterForm";

export default async function EnterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="enter">
      <span className="brand">Dunya Family</span>
      <p className="muted">Photos, birthdays, and gatherings for our family. Enter the family password to come in.</p>
      <EnterForm next={next?.startsWith("/") ? next : "/"} />
    </div>
  );
}

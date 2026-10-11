import { ComeIn } from "@/components/ComeIn";

export default async function EnterPage({ searchParams }: { searchParams: Promise<{ next?: string; changed?: string }> }) {
  const { next, changed } = await searchParams;
  return <ComeIn next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} changed={changed === "1"} />;
}

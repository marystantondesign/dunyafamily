import { ComeIn } from "@/components/ComeIn";

export default async function EnterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <ComeIn next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />;
}

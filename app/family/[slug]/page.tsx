import Link from "next/link";
import { notFound } from "next/navigation";
import { SiblingTree } from "@/components/SiblingTree";
import { siblingFamily } from "@/lib/family";

export const dynamic = "force-dynamic";

export default async function SiblingFamilyPage({ params }: { params: Promise<{ slug: string }> }) {
  const fam = await siblingFamily((await params).slug);
  if (!fam) notFound();
  const first = fam.node.person.name.split(" ")[0];
  return (
    <>
      <nav className="family-crumbs" aria-label="Breadcrumb">
        <Link href="/people?earlier=1"><span aria-hidden="true">←</span> {fam.rootName}&apos;s family</Link>
        <span aria-hidden="true" className="muted"> / </span>
        <span aria-current="page">{first}&apos;s family</span>
      </nav>
      <h1 className="sr-only">{first}&apos;s family</h1>
      <SiblingTree tree={fam.node} sub={fam.sub} />
    </>
  );
}

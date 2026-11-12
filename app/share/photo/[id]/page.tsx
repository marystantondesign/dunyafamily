import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { photoPreview } from "@/lib/sharePreview";
import { GoToEnter } from "../../prayer/GoToEnter";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

/** Where to go after the family password: the photo link that was shared, and nothing else. */
async function enterHref(props: Props) {
  const id = Number((await props.params).id);
  const from = (await props.searchParams).from ?? "";
  const next = from.startsWith(`/photos/${id}`) && !from.startsWith("//") ? from : `/photos/${id}`;
  return `/enter?next=${encodeURIComponent(next)}`;
}

// The preview card: the one photo, with no names, dates, or captions.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const pv = await photoPreview(Number((await props.params).id));
  if (!pv) return {};
  const image = { url: `/share/p/${pv.token}.jpg`, width: pv.width, height: pv.height, alt: "A photo from the family archive" };
  return {
    title: "Dunya Family",
    description: "A photo from the family archive",
    openGraph: { title: "Dunya Family", description: "A photo from the family archive", siteName: "Dunya Family", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: "Dunya Family", description: "A photo from the family archive", images: [image.url] },
  };
}

/** Someone signed out who opens a shared photo link passes through here to the family password, then on to the photo. */
export default async function SharePhoto(props: Props) {
  const href = await enterHref(props);
  // Photos that don't get a preview (hidden, waiting on a removal request, or previews off): the usual password page.
  if (!(await photoPreview(Number((await props.params).id)))) redirect(href);
  return (
    <div className="share-pass">
      <GoToEnter href={href} />
      <p>Dunya Family</p>
      <Link href={href} className="btn btn-primary">Come in</Link>
    </div>
  );
}

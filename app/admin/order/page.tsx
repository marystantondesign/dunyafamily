import { notFound } from "next/navigation";
import { FamilyOrderEditor } from "@/components/FamilyOrderEditor";
import { getSession, isAdmin } from "@/lib/auth";
import { findDunya } from "@/lib/featured";
import { loadFamily } from "@/lib/family";
import { storedOrder, unplaced } from "@/lib/familyOrder";

export const dynamic = "force-dynamic";

/** Family order: the order of Home's Everyone list, the sign-in picker, and the people offered first when tagging. */
export default async function FamilyOrderPage() {
  if (!isAdmin(await getSession())) notFound();
  const [f, dunya] = await Promise.all([loadFamily(), findDunya()]);
  const o = await storedOrder(f);
  const name = (id: number) => f.byId.get(id)?.name ?? "";
  const live = (ids: number[]) => ids.filter((id) => f.byId.has(id)).map((id) => ({ id, name: name(id) }));
  const extra = dunya && f.byId.has(dunya.id) ? unplaced(f, dunya.id, o) : [];
  const placed = new Set([...o.main, ...o.earlier]);
  const others = f.people.filter((p) => !placed.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="admin-page narrow">
      <div className="page-head">
        <h1 className="display">Family order</h1>
        <p>The order of Everyone on Home, the sign-in screen, and the people offered first when tagging. Everyone not listed shows under Partners and extended family.</p>
      </div>
      <FamilyOrderEditor main={[...live(o.main), ...live(extra)]} earlier={live(o.earlier)} others={others} />
    </div>
  );
}

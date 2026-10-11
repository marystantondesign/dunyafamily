import { notFound } from "next/navigation";
import { FamilyPasswordForm } from "@/components/FamilyPasswordForm";
import { getSession, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FamilyPasswordPage() {
  if (!isAdmin(await getSession())) notFound();
  return (
    <div className="admin-page narrow">
      <div className="page-head">
        <h1 className="display">Family password</h1>
        <p>Change the password everyone uses to come in. Everyone else is signed out and will need the new one. Your admin password doesn&apos;t change.</p>
      </div>
      <FamilyPasswordForm />
    </div>
  );
}

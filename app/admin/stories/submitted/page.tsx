import { redirect } from "next/navigation";

/** Submitted stories live in My stories now, on the Submitted tab. */
export default function SubmittedPage() {
  redirect("/admin/stories?tab=submitted");
}

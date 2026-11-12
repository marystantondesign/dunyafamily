import { adminOr404, saveStory, type SaveBody } from "@/lib/storySave";

/** Mary only: start a new story (Add a story). */
export async function POST(req: Request) {
  const no = await adminOr404();
  if (no) return no;
  return saveStory(null, (await req.json().catch(() => ({}))) as SaveBody);
}

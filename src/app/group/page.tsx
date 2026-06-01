import { redirect } from "next/navigation";

// Intentional legacy redirect: the singular `/group` path is kept only to
// forward old links to the current `/groups` list. No UI lives here.
export const dynamic = "force-dynamic";

export default function LegacyGroupPage() {
  redirect("/groups");
}

import { redirect } from "next/navigation";

/** @deprecated Prefer `/` — retained for old bookmarks */
export default function DemoHomeLegacyPage() {
  redirect("/");
}

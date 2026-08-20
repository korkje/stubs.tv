import { redirect } from "next/navigation";

/**
 * The import surface moved into Settings as its own tab. The route stays
 * because links to it are in the wild — the public /import/tv-time page
 * sends new signups through ?next=/app/import — and a bookmark should keep
 * working forever.
 */
export default function ImportPage() {
  redirect("/app/settings?tab=import");
}

import { redirect } from "next/navigation";

// The app home is the shows dashboard; shows and films have their own pages.
export default function AppHome() {
  redirect("/app/shows");
}

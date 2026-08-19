import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildCalendar, type CalendarEpisode } from "@/lib/calendar/ics";

/**
 * The tokenized iCal feed (ADR-0018): upcoming episodes of followed shows,
 * polled by the user's calendar app. Calendar clients cannot sign in, so
 * the URL is the credential — which is why this route uses the service
 * client: there is no session, and calendar_feed() scopes everything to
 * the token's owner. An unknown (or malformed) token is a plain 404 that
 * never reveals whether a token exists.
 *
 * The auth proxy guards /app and /admin only, so this route is reachable
 * without a session by design — do not "fix" that by widening the matcher.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // ".ics" in the pasted URL is friendlier to calendar clients; the token
  // itself is the segment without it.
  const token = (await params).token.replace(/\.ics$/, "").toLowerCase();
  if (!UUID_RE.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("calendar_feed", {
    p_token: token,
  });

  if (error) {
    throw new Error(`Calendar feed failed: ${error.message}`);
  }

  // Zero rows = unknown token. A known token with nothing upcoming returns
  // a valid empty calendar instead — clients treat a 404 as a broken
  // subscription, not an empty one.
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { episodes } = data as unknown as { episodes: CalendarEpisode[] };

  const body = buildCalendar({
    episodes,
    origin: new URL(request.url).origin,
    now: new Date(),
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // The URL is a credential and the content is personal: nothing
      // between the client and us may cache it.
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

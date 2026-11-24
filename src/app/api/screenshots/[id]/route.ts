import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { screenshots } from "@/server/db/schema";
import { currentUser } from "@/server/session";

/**
 * Serves a screenshot from the private Blob store behind the login (D18).
 * The blob URL never reaches the browser.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/screenshots/[id]">,
) {
  await connection();
  if (!(await currentUser())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const [shot] = await getDb()
    .select({ pathname: screenshots.pathname })
    .from(screenshots)
    .where(eq(screenshots.id, id));
  if (!shot) return Response.json({ error: "not found" }, { status: 404 });

  const blob = await get(shot.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return new Response(blob.stream, {
    headers: {
      "Content-Type": "image/jpeg",
      // Fixed content per id; only this browser may keep it.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

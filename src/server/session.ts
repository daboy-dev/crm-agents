import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/**
 * The logged-in user, or null. The proxy already guards every private route;
 * route handlers and server actions check again as defence in depth.
 */
export async function currentUser(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value,
    secret,
  );
}

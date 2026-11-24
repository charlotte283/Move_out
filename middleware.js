import { NextResponse } from "next/server";
// Shared-password gate. Set APP_PASSWORD on the server; if unset (local use) the app stays open.
export function middleware(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Basic ")) {
    const dec = atob(h.slice(6));
    if (dec.slice(dec.indexOf(":") + 1) === pw) return NextResponse.next();
  }
  return new NextResponse("Password required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="MOVEOUT"' } });
}
export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };

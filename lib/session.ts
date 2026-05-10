import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "gtp_ro_session";

export function getSessionId(request: NextRequest): { id: string; created: boolean } {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing) {
    return { id: existing, created: false };
  }

  return { id: crypto.randomUUID(), created: true };
}

export function attachSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });
}

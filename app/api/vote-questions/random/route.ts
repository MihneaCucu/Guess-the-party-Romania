import { NextRequest, NextResponse } from "next/server";
import { getRandomVoteQuestion } from "@/lib/data-store";
import { attachSessionCookie, getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionId(request);
    const payload = await getRandomVoteQuestion(session.id);
    const response = NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

    if (session.created) {
      attachSessionCookie(response, session.id);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

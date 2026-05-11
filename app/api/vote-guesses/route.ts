import { NextRequest, NextResponse } from "next/server";
import { recordVoteGuess } from "@/lib/data-store";
import { isRateLimited } from "@/lib/rate-limit";
import { attachSessionCookie, getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionId(request);
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateLimitKey = session.id || forwardedFor || "anonymous";

  if (isRateLimited(`vote:${rateLimitKey}`)) {
    return NextResponse.json({ error: "Too many guesses. Try again in a minute." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      questionId?: string;
      guessedParty?: string;
      currentStreak?: number;
      bestStreak?: number;
    };

    if (!body.questionId || !body.guessedParty) {
      return NextResponse.json({ error: "questionId and guessedParty are required." }, { status: 400 });
    }

    const result = await recordVoteGuess(
      session.id,
      body.questionId,
      body.guessedParty,
      Number(body.bestStreak ?? 0),
      Number(body.currentStreak ?? 0)
    );
    const response = NextResponse.json(result);

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

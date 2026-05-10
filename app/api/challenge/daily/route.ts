import { NextRequest, NextResponse } from "next/server";
import { dailyChallengeDateKey } from "@/lib/daily";
import { getDailyChallenge } from "@/lib/data-store";

export const dynamic = "force-dynamic";

function parseDate(request: NextRequest): string {
  const raw = request.nextUrl.searchParams.get("date");
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : dailyChallengeDateKey();
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getDailyChallenge(parseDate(request));
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

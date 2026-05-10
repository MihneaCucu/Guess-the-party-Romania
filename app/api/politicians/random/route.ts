import { NextRequest, NextResponse } from "next/server";
import { getRandomPublicPolitician } from "@/lib/data-store";
import { attachSessionCookie, getSessionId } from "@/lib/session";
import type { PoliticianScope } from "@/lib/types";

export const dynamic = "force-dynamic";

const SCOPE_BY_PARAM: Record<string, PoliticianScope> = {
  all: "all",
  senat: "Senat",
  senate: "Senat",
  camera: "Camera Deputatilor",
  "camera-deputatilor": "Camera Deputatilor",
  deputati: "Camera Deputatilor",
  chamber: "Camera Deputatilor",
  guvern: "Guvern",
  government: "Guvern",
  meps: "Parlamentul European",
  mep: "Parlamentul European",
  europarlamentari: "Parlamentul European",
  "european-parliament": "Parlamentul European"
};

function parseScope(request: NextRequest): PoliticianScope {
  const raw = request.nextUrl.searchParams.get("scope") ?? request.nextUrl.searchParams.get("chamber") ?? "all";
  return SCOPE_BY_PARAM[raw.toLowerCase()] ?? "all";
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionId(request);
    const payload = await getRandomPublicPolitician(session.id, parseScope(request));
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

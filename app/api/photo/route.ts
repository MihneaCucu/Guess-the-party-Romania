import http from "node:http";
import https from "node:https";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set(["senat.ro", "www.senat.ro", "cdep.ro", "www.cdep.ro", "gov.ro", "www.gov.ro"]);

type ImageResponse = {
  buffer: Buffer;
  contentType: string;
};

function requestImage(url: URL, redirects = 0): Promise<ImageResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "http:" ? http : https;
    const request = client.request(
      url,
      {
        headers: {
          "User-Agent": "GuessThePartyRO/0.1 photo proxy"
        },
        rejectUnauthorized: !url.hostname.endsWith("cdep.ro"),
        timeout: 12000
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location && redirects < 3) {
          response.resume();
          resolve(requestImage(new URL(location, url), redirects + 1));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const contentType = String(response.headers["content-type"] ?? "");
          if (status < 200 || status >= 300 || !contentType.startsWith("image/")) {
            reject(new Error(`Photo request failed: ${status} ${contentType}`));
            return;
          }

          resolve({ buffer: Buffer.concat(chunks), contentType });
        });
      }
    );

    request.on("timeout", () => request.destroy(new Error("Photo request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");
  if (!source) return Response.json({ error: "Missing url." }, { status: 400 });

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return Response.json({ error: "Invalid url." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname)) {
    return Response.json({ error: "Photo host is not allowed." }, { status: 400 });
  }

  try {
    const image = await requestImage(url);
    return new Response(new Uint8Array(image.buffer), {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": image.contentType
      }
    });
  } catch {
    return Response.json({ error: "Photo unavailable." }, { status: 502 });
  }
}

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Row = Record<string, string>;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const csvPath = join(root, "data/seed-politicians.csv");
const mockPath = join(root, "lib/mock-data.ts");
const sourceDir = join(root, ".photo-cache/source");
const portraitDir = join(root, "public/photos/portraits");
const thumbDir = join(root, "public/photos/thumbs");
const headers = [
  "id",
  "name",
  "slug",
  "party_key",
  "party_label",
  "chamber",
  "constituency",
  "photo_url",
  "source_url",
  "active",
  "review_status"
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some(Boolean));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll("\"", "\"\"")}"`;
  return value;
}

function rowsFromCsv(text: string): Row[] {
  const [headerRow, ...dataRows] = parseCsv(text);
  if (headers.some((header) => !headerRow.includes(header))) {
    throw new Error(`Unexpected CSV headers: ${headerRow.join(", ")}`);
  }
  return dataRows.map((dataRow) => Object.fromEntries(headerRow.map((header, index) => [header, dataRow[index] ?? ""])));
}

function rowsToCsv(rows: Row[]): string {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function download(url: string, file: string, redirects = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "http:" ? http : https;
    const request = client.get(
      parsed,
      {
        headers: {
          "User-Agent": "GuessThePartyRO/0.1 photo cache"
        },
        rejectUnauthorized: !parsed.hostname.endsWith("cdep.ro"),
        timeout: 20000
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location && redirects < 4) {
          response.resume();
          download(new URL(location, parsed).toString(), file, redirects + 1).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300 || !String(response.headers["content-type"] ?? "").startsWith("image/")) {
          response.resume();
          reject(new Error(`${url} -> ${status} ${response.headers["content-type"] ?? ""}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          writeFileSync(file, Buffer.concat(chunks));
          resolve();
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error(`Timed out: ${url}`)));
    request.on("error", reject);
  });
}

async function sourceFor(row: Row): Promise<string> {
  const existingUrl = row.photo_url;
  const sourceFile = join(sourceDir, `${row.id}${existingUrl.toLowerCase().endsWith(".png") ? ".png" : ".jpg"}`);
  if (existsSync(sourceFile)) return sourceFile;

  if (existingUrl.startsWith("/")) {
    const localFile = join(root, "public", existingUrl);
    if (!existsSync(localFile)) throw new Error(`${row.id}: missing local photo ${localFile}`);
    return localFile;
  }

  await download(existingUrl, sourceFile);
  return sourceFile;
}

function resize(source: string, target: string, maxPixels: number) {
  execFileSync("sips", ["--resampleHeightWidthMax", String(maxPixels), "-s", "format", "jpeg", source, "--out", target], {
    stdio: "ignore"
  });
}

function updateMockData(photoUrls: Map<string, string>) {
  let mock = readFileSync(mockPath, "utf8");
  mock = mock.replace(/(\{\n    "id": "([^"]+)"[\s\S]*?    "photo_url": ")([^"]+)(",)/g, (match, prefix: string, id: string, _old: string, suffix: string) => {
    const photoUrl = photoUrls.get(id);
    return photoUrl ? `${prefix}${photoUrl}${suffix}` : match;
  });
  writeFileSync(mockPath, mock);
}

async function main() {
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(portraitDir, { recursive: true });
  mkdirSync(thumbDir, { recursive: true });

  const rows = rowsFromCsv(readFileSync(csvPath, "utf8"));
  const approved = rows.filter((row) => row.active === "true" && row.review_status === "approved" && row.photo_url);
  const photoUrls = new Map<string, string>();
  let completed = 0;

  for (const row of approved) {
    const portraitUrl = `/photos/portraits/${row.id}.jpg`;
    const thumbUrl = `/photos/thumbs/${row.id}.jpg`;
    const portraitFile = join(root, "public", portraitUrl);
    const thumbFile = join(root, "public", thumbUrl);

    if (!existsSync(portraitFile) || !existsSync(thumbFile)) {
      const source = await sourceFor(row);
      resize(source, portraitFile, 640);
      resize(source, thumbFile, 96);
    }

    row.photo_url = portraitUrl;
    photoUrls.set(row.id, portraitUrl);
    completed += 1;
    if (completed % 25 === 0 || completed === approved.length) {
      process.stdout.write(`Cached ${completed}/${approved.length}: ${basename(portraitFile)}\n`);
    }
  }

  writeFileSync(csvPath, rowsToCsv(rows));
  updateMockData(photoUrls);
  process.stdout.write(`Done. Cached ${completed} photos into public/photos/portraits and public/photos/thumbs.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

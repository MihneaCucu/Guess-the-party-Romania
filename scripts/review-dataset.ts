import { readFileSync } from "node:fs";

const requiredHeaders = [
  "id",
  "name",
  "source_url",
  "photo_url",
  "has_public_photo",
  "photo_quality_ok",
  "no_party_logo_or_rosette",
  "duplicate_of",
  "review_status",
  "notes"
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
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

function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: tsx scripts/review-dataset.ts data/manual-review.csv");

  const rows = parseCsv(readFileSync(file, "utf8"));
  const headers = rows[0] ?? [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing review columns: ${missingHeaders.join(", ")}`);
  }

  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const row of rows.slice(1)) {
    const id = row[index.id];
    if (!id) errors.push("A row is missing id.");
    if (seenIds.has(id)) errors.push(`Duplicate id: ${id}`);
    seenIds.add(id);

    const status = row[index.review_status];
    if (!["approved", "needs_review", "rejected"].includes(status)) {
      errors.push(`${id}: invalid review_status ${status}`);
    }

    if (status === "approved") {
      if (row[index.has_public_photo] !== "true") errors.push(`${id}: approved row needs has_public_photo=true`);
      if (row[index.photo_quality_ok] !== "true") errors.push(`${id}: approved row needs photo_quality_ok=true`);
      if (row[index.no_party_logo_or_rosette] !== "true") errors.push(`${id}: approved row needs no_party_logo_or_rosette=true`);
      if (!row[index.photo_url]) errors.push(`${id}: approved row needs photo_url`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  process.stdout.write(`Review file OK: ${rows.length - 1} rows\n`);
}

main();

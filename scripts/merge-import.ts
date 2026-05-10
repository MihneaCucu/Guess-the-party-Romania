import { readFileSync, writeFileSync } from "node:fs";

type Row = Record<string, string>;

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
  return /[",\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

function rowsFromCsv(text: string): { headers: string[]; rows: Row[] } {
  const [headers, ...dataRows] = parseCsv(text);
  return {
    headers,
    rows: dataRows.map((dataRow) => Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])))
  };
}

function rowsToCsv(headers: string[], rows: Row[]): string {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function main() {
  const [targetPath, importPath] = process.argv.slice(2);
  if (!targetPath || !importPath) throw new Error("Usage: tsx scripts/merge-import.ts data/seed-politicians.csv imported.csv");

  const target = rowsFromCsv(readFileSync(targetPath, "utf8"));
  const imported = rowsFromCsv(readFileSync(importPath, "utf8"));
  const missing = target.headers.filter((header) => !imported.headers.includes(header));
  if (missing.length > 0) throw new Error(`Imported CSV is missing headers: ${missing.join(", ")}`);

  const byId = new Map(target.rows.map((row) => [row.id, row]));
  for (const row of imported.rows) {
    byId.set(row.id, Object.fromEntries(target.headers.map((header) => [header, row[header] ?? ""])));
  }

  writeFileSync(targetPath, rowsToCsv(target.headers, Array.from(byId.values())));
  process.stdout.write(`Merged ${imported.rows.length} rows into ${targetPath}\n`);
}

main();

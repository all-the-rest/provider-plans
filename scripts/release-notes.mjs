#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const VENDORS = ["zai", "mimo"];
export const VENDOR_LABELS = {
  zai: "z.ai GLM Coding Plan",
  mimo: "Xiaomi MiMo Token Plan",
};

/** Lädt alle Changelog-Einträge aller Vendors und sortiert neueste zuerst. */
export function loadEntries() {
  const all = [];
  for (const v of VENDORS) {
    const data = JSON.parse(readFileSync(join(ROOT, `src/vendors/${v}/data/changelog.json`), "utf8"));
    for (const entry of data?.entries ?? []) {
      all.push({ id: entry.id, date: entry.date, changes: entry.changes, vendor: v });
    }
  }
  return all.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/** Fasst Einträge gleicher Run-id (gleicher Tag) über die Vendors zusammen. */
export function mergeById(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = e.id ?? e.date;
    if (!groups.has(key)) groups.set(key, { id: key, date: e.date, vendors: [] });
    groups.get(key).vendors.push({ vendor: e.vendor, changes: e.changes ?? [] });
  }
  return [...groups.values()];
}

export function renderEntry(entry) {
  const label =
    entry.vendors.length === 1 ? VENDOR_LABELS[entry.vendors[0].vendor] ?? entry.vendors[0].vendor : "all providers";
  const lines = [`# Price Update ${entry.date}`, "", `Price changes on **${entry.date}** (${label}):`, ""];
  for (const g of entry.vendors) {
    for (const c of g.changes) {
      const prefix = entry.vendors.length > 1 ? `- **${VENDOR_LABELS[g.vendor] ?? g.vendor}:** ` : "- ";
      lines.push(prefix + (c.en ?? c.de));
    }
  }
  return lines.join("\n");
}

/** Render für einen (ggf. gemergten) Eintrag; null wenn keine Änderungen. */
export function renderReleaseNotesForEntry(entry) {
  if (!entry || !Array.isArray(entry.vendors) || entry.vendors.every((g) => g.changes.length === 0)) return null;
  return renderEntry(entry);
}

export function renderLatestReleaseNotes() {
  const merged = mergeById(loadEntries());
  const latest = merged[0];
  return latest ? renderReleaseNotesForEntry(latest) : null;
}

function main() {
  const merged = mergeById(loadEntries());
  const argv = process.argv.slice(2);
  const dateIdx = argv.indexOf("--date");
  const date =
    (dateIdx !== -1 ? argv[dateIdx + 1] : null) ??
    (argv.find((a) => a.startsWith("--date="))?.slice("--date=".length) ?? null);
  const entry = date ? merged.find((e) => e.id === date || e.date === date) : merged[0];
  if (!entry) {
    console.error(`no changelog entry found${date ? ` for date ${date}` : ""}`);
    process.exit(1);
  }
  const notes = renderReleaseNotesForEntry(entry);
  if (notes !== null) process.stdout.write(notes + "\n");
}

const isMain =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
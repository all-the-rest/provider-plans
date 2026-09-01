import type { ChangelogEntry, VendorId } from "./types";
import mimoChangelog from "./vendors/mimo/data/changelog.json";
import ollamaChangelog from "./vendors/ollama/data/changelog.json";
import zaiChangelog from "./vendors/zai/data/changelog.json";

export const CHANGELOGS: Record<VendorId, ChangelogEntry[]> = {
  zai: (zaiChangelog as unknown as { entries: ChangelogEntry[] }).entries,
  mimo: (mimoChangelog as unknown as { entries: ChangelogEntry[] }).entries,
  ollama: (ollamaChangelog as unknown as { entries: ChangelogEntry[] }).entries,
};
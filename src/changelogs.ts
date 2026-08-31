import type { ChangelogEntry, VendorId } from "./types";
import zaiChangelog from "./vendors/zai/data/changelog.json";
import mimoChangelog from "./vendors/mimo/data/changelog.json";

export const CHANGELOGS: Record<VendorId, ChangelogEntry[]> = {
  zai: (zaiChangelog as unknown as { entries: ChangelogEntry[] }).entries,
  mimo: (mimoChangelog as unknown as { entries: ChangelogEntry[] }).entries,
};
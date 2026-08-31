import type { VendorId, VendorModule } from "../types";
import { vendorModule as zai } from "./zai";
import { vendorModule as mimo } from "./mimo";

export const VENDOR_MODULES: VendorModule[] = [zai, mimo];

export const VENDOR_MAP: Record<VendorId, VendorModule> = { zai, mimo };

export const NAV_VENDORS = VENDOR_MODULES.map((m) => ({
  path: m.meta.path,
  name: m.meta.shortName,
}));
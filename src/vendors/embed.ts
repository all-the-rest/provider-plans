import { makeFormulas as zaiFormulas } from "./zai/formulas";
import { makeFormulas as mimoFormulas } from "./mimo/formulas";
import { makeFormulas as ollamaFormulas } from "./ollama/formulas";
import type { Formulas, PeakConfig, VendorId, VendorModule, VendorPriceData } from "../types";

/**
 * Serialisierbarer Vendor-Anteil: alles außer den Formel-Funktionen. Wird beim
 * Prerender als JSON (`#__VENDORS__`) in die HTML-Dateien eingebettet, damit der
 * Client denselben Zustand SYNCHRON rekonstruieren kann → Hydration passt exakt
 * zum Server-Output (kein „Lade…"-Fallback, keine async-Lücke).
 */
export type EmbeddedVendor = Omit<VendorModule, "formulas">;

const FACTORIES: Record<
  VendorId,
  (data: VendorPriceData, peak: PeakConfig, flagshipId: string) => Formulas
> = {
  zai: zaiFormulas,
  mimo: mimoFormulas,
  ollama: ollamaFormulas,
};

export function serializeVendors(vendors: VendorModule[]): EmbeddedVendor[] {
  return vendors.map(({ formulas: _formulas, ...rest }) => rest);
}

export function hydrateVendors(entries: EmbeddedVendor[]): VendorModule[] {
  return entries.map((entry) => ({
    ...entry,
    formulas: FACTORIES[entry.meta.id](entry.data, entry.peak, entry.meta.flagshipId),
  }));
}

/** Vendor-Module aus dem eingebetteten JSON lesen (nur im Browser). */
export function readEmbeddedVendors(): VendorModule[] | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("__VENDORS__");
  if (!el?.textContent) return null;
  try {
    return hydrateVendors(JSON.parse(el.textContent) as EmbeddedVendor[]);
  } catch {
    return null;
  }
}

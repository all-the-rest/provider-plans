import type { VendorId, VendorModule } from "../types";

export const NAV_VENDORS: { path: string; name: string }[] = [
  { path: "/z-ai", name: "z.ai" },
  { path: "/mimo", name: "MiMo" },
  { path: "/ollama", name: "Ollama" },
];

// Lazy loader für VendorModule – erzeugt separaten Chunk pro Vendor (Vite code-splitting)
export async function loadVendor(id: VendorId): Promise<VendorModule> {
  switch (id) {
    case "zai":
      return (await import("./zai")).vendorModule;
    case "mimo":
      return (await import("./mimo")).vendorModule;
    case "ollama":
      return (await import("./ollama")).vendorModule;
    default:
      throw new Error(`Unknown vendor ${id}`);
  }
}

// Eager-Variante nur für StartPage (Home) – wird dort via createResource geladen, nicht im Main-Bundle statisch
export async function loadAllVendors(): Promise<VendorModule[]> {
  const [zai, mimo, ollama] = await Promise.all([import("./zai"), import("./mimo"), import("./ollama")]);
  return [zai.vendorModule, mimo.vendorModule, ollama.vendorModule];
}
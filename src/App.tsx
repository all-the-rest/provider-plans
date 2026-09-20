import { RouterProvider } from "./router";
import AppRoutes from "./AppRoutes";
import type { Lang, VendorModule } from "./types";

export interface AppProps {
  /** Initialer Pfad (SSR) — ohne Angabe wird `window.location.pathname` genutzt. */
  initialPath?: string;
  /** Initiale Sprache (SSR). Default: aus dem Pfadpräfix abgeleitet (en). */
  lang?: Lang;
  /** Synchron verfügbare Vendor-Module (SSR statisch, Client aus `#__VENDORS__`). */
  vendors: VendorModule[];
}

export default function App(props: AppProps) {
  return (
    <RouterProvider initialPath={props.initialPath}>
      <AppRoutes lang={props.lang} vendors={props.vendors} />
    </RouterProvider>
  );
}

import { hydrate, render } from "solid-js/web";
import App from "./App";
import "./index.css";
import { loadAllVendors } from "./vendors/registry";
import { readEmbeddedVendors } from "./vendors/embed";

async function main() {
  const root = document.getElementById("root");
  if (!root) return;
  // Bevorzugt den beim Prerender eingebetteten Vendor-Zustand (synchron → die
  // Hydration passt exakt zum Server-HTML). Im Dev-Server ohne Prerender wird
  // asynchron geladen und normal gerendert.
  const vendors = readEmbeddedVendors() ?? (await loadAllVendors());
  const app = () => <App vendors={vendors} />;
  if (root.firstChild) hydrate(app, root);
  else render(app, root);
}

void main();

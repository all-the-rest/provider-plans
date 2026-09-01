import { createMemo } from "solid-js";
import type { Lang, Translation } from "../types";
import { shell } from "../i18n";
import { useRouter } from "../router";
import Header from "../components/Header";
import { NAV_VENDORS } from "../vendors/registry";

export interface LegalPageProps {
  kind: "impressum" | "datenschutz";
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
}

export interface LegalContent {
  imprint: {
    name: string;
    address: string[];
    email: string;
    note: string;
  };
  privacy: string[];
}

/** Sprachabhängige Rechtstexte (identische Festdaten in beiden Sprachen). */
export function buildLegal(t: Translation): LegalContent {
  const isDe = t.brand.includes("Pläne") || t.navHome === "Start" || t.perMonth === "Monat";
  return {
    imprint: {
      name: "Florian Reisinger",
      address: ["Robert-Stolz-Straße 8", "4020 Linz, Österreich"],
      email: "hello@all-the.rest",
      note: isDe
        ? "Angaben gemäß § 5 ECG. Privates, nicht-kommerzielles Projekt."
        : "Information pursuant to § 5 ECG (Austria). Private, non-commercial project.",
    },
    privacy: isDe
      ? [
          "Ihre Rechte: Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch — Kontakt über hello@all-the.rest. Weiters Beschwerderecht bei der österreichischen Datenschutzbehörde (Barichgasse 40–42, 1030 Wien).",
          "Diese Website verwendet keine Cookies, kein Tracking und keine Analyse- oder Werbedienste. Es werden keine personenbezogenen Daten erhoben, gespeichert oder an Dritte weitergegeben.",
          "Beim Abruf der Seiten verarbeitet der Hosting-Anbieter technisch notwendige Server-Logdaten (z. B. IP-Adresse, Zeitstempel) ausschließlich zum Betrieb der Website.",
          "Die angezeigten Preisdaten stammen aus den öffentlich zugänglichen Preis- oder Dokumentationsseiten der jeweiligen Anbieter und werden automatisch aktualisiert. Preise gehören den jeweiligen Anbietern.",
        ]
      : [
          "Your rights: access, rectification, erasure, restriction and objection — contact hello@all-the.rest. You also have the right to lodge a complaint with the Austrian data protection authority (Barichgasse 40–42, 1030 Vienna).",
          "This website uses no cookies, no tracking, and no analytics or advertising services. No personal data is collected, stored, or shared with third parties.",
          "When pages are accessed, the hosting provider processes technically necessary server log data (e.g. IP address, timestamp) solely to operate the website.",
          "The displayed price data is sourced from the publicly accessible pricing or documentation pages of the respective providers and is updated automatically. Prices belong to their respective providers.",
        ],
  };
}

export default function LegalPage(props: LegalPageProps) {
  const { path } = useRouter();
  const t = () => ({ ...shell[props.lang], peakWeekendNote: "" }) as Translation;
  const content = createMemo(() => buildLegal(t()));

  return (
    <div class="flex min-h-screen w-full flex-col bg-base-100 text-base-content">
      <Header
        lang={props.lang}
        setLang={props.setLang}
        dark={props.dark}
        setDark={props.setDark}
        path={path}
        vendors={NAV_VENDORS}
        t={t()}
      />

      <main class="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-12">
        {props.kind === "impressum" ? (
          <section class="grid gap-3">
            <h1 class="text-3xl font-bold">{t().impressum}</h1>
            <div class="mt-1 text-sm leading-relaxed text-base-content/80">
              <p class="font-medium">{content().imprint.name}</p>
              {content().imprint.address.map((l) => (
                <p>{l}</p>
              ))}
              <p>
                E-Mail:{" "}
                <a href={`mailto:${content().imprint.email}`} class="link link-primary">
                  {content().imprint.email}
                </a>
              </p>
              <p class="mt-3 text-base-content/70">{content().imprint.note}</p>
            </div>
          </section>
        ) : (
          <section class="grid gap-3">
            <h1 class="text-3xl font-bold">{t().datenschutz}</h1>
            <div class="mt-1 space-y-3 text-sm leading-relaxed text-base-content/80">
              {content().privacy.map((p) => (
                <p>{p}</p>
              ))}
            </div>
          </section>
        )}

        <p class="mt-12">
          <a href="/" class="link link-hover">
            ← {t().navHome}
          </a>
        </p>
      </main>

      <footer class="footer sm:footer-horizontal border-t border-base-300 bg-base-200 px-8 py-6">
        <span class="text-sm text-base-content/70">{t().footerNote}</span>
        <div class="flex flex-wrap items-center gap-x-3 text-sm text-base-content/70">
          <a class="link" href="/impressum">{t().impressum}</a>
          <a class="link" href="/datenschutz">{t().datenschutz}</a>
        </div>
      </footer>
    </div>
  );
}
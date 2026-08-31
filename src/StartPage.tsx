import { For } from "solid-js";
import type { Lang, Translation } from "./types";
import { shell } from "./i18n";
import Header from "./components/Header";
import { NAV_VENDORS, VENDOR_MODULES } from "./vendors/registry";
import { fmt, fmtBig } from "./util";

interface StartPageProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
}

export default function StartPage(props: StartPageProps) {
  const t = () =>
    ({ ...shell[props.lang], peakWeekendNote: "" }) as Translation;
  return (
    <div class="min-h-screen w-full bg-base-100 text-base-content">
      <Header
        lang={props.lang}
        setLang={props.setLang}
        dark={props.dark}
        setDark={props.setDark}
        path={() => "/"}
        vendors={NAV_VENDORS}
        t={t()}
      />
      <main class="mx-auto max-w-6xl px-4 py-12">
        <section class="text-center">
          <h1 class="text-4xl font-bold">{t().brand}</h1>
          <p class="mt-3 text-lg text-base-content/70">{t().tagline}</p>
        </section>

        <section class="mt-10 grid gap-6 md:grid-cols-2">
          <For each={VENDOR_MODULES}>
            {(module) => {
              const entry = module.data.plans[0];
              const pool = entry ? module.formulas.monthlyCredits(entry) : null;
              const de = () => props.lang === "de";
              const poolBadge = () => {
                if (!entry) return null;
                return entry.kind === "weekly"
                  ? de()
                    ? "Credits/Woche"
                    : "Credits/week"
                  : de()
                    ? "Credits/Monat"
                    : "Credits/month";
              };
              return (
                <a href={module.meta.path} class="card card-border bg-base-200 transition-transform hover:-translate-y-0.5" aria-label={module.meta.name}>
                  <div class="card-body">
                    <h2 class="card-title">
                      {module.meta.name}
                      {poolBadge() ? <span class="badge badge-primary badge-sm">{poolBadge()}</span> : null}
                    </h2>
                    <p class="text-sm text-base-content/70">{module.meta.tagline}</p>
                    <div class="mt-2 flex flex-wrap gap-2 text-sm">
                      <For each={module.data.plans}>
                        {(pl) => <span class="badge badge-outline badge-md">{pl.name}</span>}
                      </For>
                    </div>
                    {entry && pool !== null ? (
                      <div class="mt-2 text-sm text-base-content/80">
                        {de() ? "Ab" : "From"} {fmt(entry.priceMonthly)}
                        {de() ? "/Monat" : "/mo"} · {fmtBig(pool)}{" "}
                        {de() ? "Credits/Monat" : "credits/mo"}
                        {entry.kind === "weekly" ? (de() ? " (×4 Wochen)" : " (×4 weeks)") : ""}
                      </div>
                    ) : null}
                    <div class="card-actions mt-4">
                      <span class="btn btn-primary btn-sm">{de() ? "Plan ansehen" : "View plan"} →</span>
                    </div>
                  </div>
                </a>
              );
            }}
          </For>
        </section>
      </main>
      <footer class="footer sm:footer-horizontal border-t border-base-300 bg-base-200 px-8 py-6">
        <span class="text-sm text-base-content/70">{t().footerNote}</span>
        <span class="text-sm text-base-content/70">
          <a class="link" href="/impressum">{t().impressum}</a> ·{" "}
          <a class="link" href="/datenschutz">{t().datenschutz}</a>
        </span>
      </footer>
    </div>
  );
}
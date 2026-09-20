import { createResource, For, Show } from "solid-js";
import type { Lang, Translation, VendorModule } from "./types";
import { shell } from "./i18n";
import Header from "./components/Header";
import VendorRanking from "./components/VendorRanking";
import Faq from "./components/Faq";
import { homeFaq } from "./seo";
import { loadAllVendors, NAV_VENDORS } from "./vendors/registry";
import { SECTION_ANCHORS, withLangPrefix } from "./routes";
import { useRouter } from "./router";
import { fmt, fmtBig } from "./util";

interface StartPageProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  /** Synchron verfügbare Vendor-Module (SSR + Client-Hydration). */
  vendors: VendorModule[];
}

export default function StartPage(props: StartPageProps) {
  const { path } = useRouter();
  const t = () => ({ ...shell[props.lang], peakWeekendNote: "" }) as Translation;

  // Fallback nur, wenn keine synchronen Module übergeben wurden (z. B. Sonderfälle).
  const [loaded] = createResource(async () =>
    props.vendors.length > 0 ? props.vendors : loadAllVendors()
  );
  const vendors = () => (props.vendors.length > 0 ? props.vendors : loaded());

  const de = () => props.lang === "de";

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
      <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12">
        <section class="text-center">
          <h1 class="text-4xl font-bold">{t().brand}</h1>
          <p class="mt-3 text-lg text-base-content/70">{t().tagline}</p>
        </section>

        <Show when={vendors()} fallback={<div class="mt-10 text-sm text-base-content/60">Lade…</div>}>
          {(list) => (
            <>
              <section class="mt-10">
                <h2 id={SECTION_ANCHORS.providers} class="scroll-mt-24 text-lg font-bold tracking-tight">
                  {de() ? "Anbieter im Überblick" : "Providers at a glance"}
                </h2>
                <div class="mt-4 grid gap-6 md:grid-cols-2">
                  <For each={list()}>
                    {(module) => {
                      const entry = module.data.plans[0];
                      const pool = entry ? module.formulas.monthlyCredits(entry) : null;
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
                        <a
                          href={withLangPrefix(module.meta.path, props.lang)}
                          class="card border border-base-300 bg-base-100 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                          aria-label={module.meta.name}
                        >
                          <div class="card-body gap-3 p-6">
                            <h3 class="card-title">
                              {module.meta.name}
                              {poolBadge() ? <span class="badge badge-primary badge-sm">{poolBadge()}</span> : null}
                            </h3>
                            <p class="text-sm leading-relaxed text-base-content/70">{module.meta.tagline}</p>
                            <div class="flex flex-wrap gap-2 text-sm">
                              <For each={module.data.plans}>
                                {(pl) => <span class="badge badge-outline badge-md">{pl.name}</span>}
                              </For>
                            </div>
                            {entry && pool !== null ? (
                              <div class="text-sm text-base-content/80">
                                {de() ? "Ab" : "From"} {fmt(entry.priceMonthly)}
                                {de() ? "/Monat" : "/mo"} · {fmtBig(pool)}{" "}
                                {de() ? "Credits/Monat" : "credits/mo"}
                                {entry.kind === "weekly" ? (de() ? " (×4 Wochen)" : " (×4 weeks)") : ""}
                              </div>
                            ) : null}
                            <div class="card-actions">
                              <span class="btn btn-primary btn-sm">{de() ? "Plan ansehen" : "View plan"} →</span>
                            </div>
                          </div>
                        </a>
                      );
                    }}
                  </For>
                </div>
              </section>

              <VendorRanking vendors={list()} lang={props.lang} t={t()} />
              <Faq
                heading={de() ? "Häufige Fragen" : "Frequently asked questions"}
                items={homeFaq(list(), props.lang)}
              />
            </>
          )}
        </Show>
      </main>
      <footer class="footer sm:footer-horizontal border-t border-base-300 bg-base-200 px-8 py-6">
        <span class="text-sm text-base-content/70">{t().footerNote}</span>
        <div class="flex flex-wrap items-center gap-x-3 text-sm text-base-content/70">
          <a class="link" href={withLangPrefix("/impressum", props.lang)}>{t().impressum}</a>
          <a class="link" href={withLangPrefix("/datenschutz", props.lang)}>{t().datenschutz}</a>
        </div>
      </footer>
    </div>
  );
}

import { createEffect, createMemo, createSignal } from "solid-js";
import type { Basis, Cycle, Lang, Plan, Translation, VendorModule } from "./types";
import { availableCycles } from "./vendors/shared";
import Header from "./components/Header";
import Hero from "./components/Hero";
import PlanTabs from "./components/PlanTabs";
import PriceTable from "./components/PriceTable";
import PlanComparison from "./components/PlanComparison";
import Changelog from "./components/Changelog";
import Footer from "./components/Footer";
import { CHANGELOGS } from "./changelogs";
import { useRouter } from "./router";

interface VendorPageProps {
  module: VendorModule;
  navVendors: { path: string; name: string }[];
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
}

export default function VendorPage(props: VendorPageProps) {
  const module = props.module;
  const { path } = useRouter();
  const t = createMemo<Translation>(() => module.i18n[props.lang]);

  const storedDefaultPlan = () => module.data.plans[0]?.id ?? "lite";

  const readParams = () => {
    const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const planRaw = p.get("plan");
    const plan = planRaw && module.data.plans.some((pl) => pl.id === planRaw) ? planRaw : null;
    const basisRaw = p.get("basis");
    const basis: Basis = basisRaw === "full" ? "full" : "list";
    const cycleRaw = p.get("cycle");
    const cycle: Cycle = cycleRaw === "quarterly" || cycleRaw === "yearly" ? cycleRaw : "monthly";
    const langRaw = p.get("lang");
    const lang: Lang | null = langRaw === "de" || langRaw === "en" ? langRaw : null;
    const theme: "dark" | null = p.get("theme") === "dark" ? "dark" : null;
    return { plan, basis, cycle, lang, theme };
  };
  const params = readParams();

  const [planId, setPlanId] = createSignal<string>(params.plan ?? storedDefaultPlan());
  const [basis, setBasis] = createSignal<Basis>(params.basis);
  const [cycle, setCycle] = createSignal<Cycle>(params.cycle);

  const plan = () => module.data.plans.find((pl) => pl.id === planId()) ?? module.data.plans[0]!;
  const planModels = createMemo(() => module.data.models);

  // Ungültigen Zyklus (z. B. Quartal bei MiMo) auf den ersten verfügbaren klemmen.
  createEffect(() => {
    const avail = availableCycles(plan());
    if (!avail.includes(cycle())) setCycle(avail[0]);
  });

  createEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (plan().id === module.data.plans[0]?.id) sp.delete("plan");
    else sp.set("plan", plan().id);
    if (basis() === "list") sp.delete("basis");
    else sp.set("basis", basis());
    if (cycle() === "monthly") sp.delete("cycle");
    else sp.set("cycle", cycle());
    const qs = sp.toString();
    const url = qs ? window.location.pathname + "?" + qs : window.location.pathname;
    history.replaceState(null, "", url);
  });

  return (
    <div class="flex min-h-screen w-full flex-col bg-base-100 text-base-content">
      <Header
        lang={props.lang}
        setLang={props.setLang}
        dark={props.dark}
        setDark={props.setDark}
        path={path}
        vendors={props.navVendors}
        t={t()}
      />
      <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
        <Hero
          module={module}
          plan={plan()}
          cycle={cycle()}
          setCycle={setCycle}
          t={t()}
          lang={props.lang}
          modelCount={planModels().length}
        />
        <div class="mt-8">
          <PlanTabs plans={module.data.plans} active={plan().id} onSelect={setPlanId} t={t()} />
        </div>
        <PriceTable
          module={module}
          plan={plan()}
          basis={basis()}
          setBasis={setBasis}
          cycle={cycle()}
          t={t()}
          lang={props.lang}
        />
        <PlanComparison module={module} t={t()} lang={props.lang} />
        <Changelog entries={CHANGELOGS[module.meta.id]} t={t()} lang={props.lang} />
      </main>
      <Footer t={t()} lang={props.lang} meta={module.meta} />
    </div>
  );
}
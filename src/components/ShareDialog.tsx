import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import type { Cycle, Lang, Plan, VendorModule } from "../types";
import { availableCycles } from "../vendors/shared";
import {
  buildSocialCardInput,
  CARD_DIMS,
  renderSocialSvg,
  socialCardFilename,
  type CardSize,
} from "../share/socialCard";
import { SHARE_STR } from "../share/i18n";
import { buildShareUrl, copyText, downloadBlob, svgToPngBlob } from "../share/download";

interface ShareDialogProps {
  module: VendorModule;
  plan: Plan;
  cycle: Cycle;
  lang: Lang;
}

export default function ShareDialog(props: ShareDialogProps) {
  const s = () => SHARE_STR[shareLang()];
  const totalModels = () => props.module.data.models.filter((m) => m.pattern !== null).length;
  const isPortraitSize = (size: CardSize) => size === "ig45" || size === "story";
  const defaultTopN = () =>
    Math.max(1, Math.min(isPortraitSize(cardSize()) ? 8 : 4, totalModels()));
  const maxTopN = () => Math.max(1, Math.min(8, totalModels()));

  const [cardSize, setCardSize] = createSignal<CardSize>("og");
  const [topN, setTopN] = createSignal(defaultTopN());
  const [topNManual, setTopNManual] = createSignal(false);
  const [dark, setDark] = createSignal(true);
  const [copied, setCopied] = createSignal(false);
  const [shareLang, setShareLang] = createSignal<Lang>(props.lang);
  const [shareCycle, setShareCycle] = createSignal<Cycle>(props.cycle);
  let dlg: HTMLDialogElement | undefined;

  onMount(() => {
    setShareLang(props.lang);
    setShareCycle(props.cycle);
  });

  const openDialog = () => {
    setShareLang(props.lang);
    setShareCycle(props.cycle);
    dlg?.showModal();
  };

  const input = createMemo(() =>
    buildSocialCardInput(props.module, props.plan, shareCycle(), shareLang(), topN())
  );
  const svg = createMemo(() =>
    renderSocialSvg(input(), { topN: topN(), theme: dark() ? "dark" : "light", size: cardSize() })
  );
  const dataUrl = createMemo(() => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg()));
  const dims = createMemo(() => CARD_DIMS[cardSize()]);

  const cycleOptions = createMemo(() => availableCycles(props.plan));
  createEffect(() => {
    const avail = cycleOptions();
    if (!avail.includes(shareCycle())) setShareCycle(avail[0] ?? "monthly");
  });
  createEffect(() => {
    if (!topNManual()) setTopN(defaultTopN());
  });
  const cycleName = (c: Cycle) => {
    const t = props.module.i18n[shareLang()];
    if (c === "quarterly") return t.cycleQuarterly;
    if (c === "yearly") return t.cycleYearly;
    return t.cycleMonthly;
  };

  const sharePath = () => buildShareUrl(props.module.meta.path, props.plan.id, shareCycle());
  const fullUrl = () =>
    typeof window !== "undefined" ? window.location.origin + sharePath() : sharePath();

  const onCopy = async () => {
    const ok = await copyText(fullUrl());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const onSvg = () => {
    downloadBlob(
      new Blob([svg()], { type: "image/svg+xml;charset=utf-8" }),
      socialCardFilename(props.module.meta.id, props.plan.id, shareCycle(), shareLang(), cardSize())
    );
  };

  const onPng = async () => {
    const blob = await svgToPngBlob(svg(), dims().w, dims().h);
    downloadBlob(
      blob,
      socialCardFilename(
        props.module.meta.id,
        props.plan.id,
        shareCycle(),
        shareLang(),
        cardSize()
      ).replace(/\.svg$/, ".png")
    );
  };

  const setTopNFromEvent = (e: Event) => {
    setTopNManual(true);
    setTopN(Number((e.currentTarget as HTMLSelectElement).value));
  };
  const isPortrait = () => cardSize() === "ig45" || cardSize() === "story";

  return (
    <>
      <button
        type="button"
        class="btn btn-sm btn-outline"
        data-testid="share-open"
        onClick={openDialog}
      >
        <span class="icon-[material-symbols--share] h-4 w-4" aria-hidden="true" />
        <span>{s().open}</span>
      </button>
      <dialog ref={(el) => (dlg = el)} class="modal" data-testid="share-dialog">
        <div class="modal-box max-w-3xl">
          <form method="dialog">
            <button
              type="submit"
              class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label={s().close}
              data-testid="share-close"
            >
              ✕
            </button>
          </form>
          <h3 class="text-lg font-bold">{s().title}</h3>
          <div class="mt-4 flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 whitespace-nowrap text-sm">
              <span class="whitespace-nowrap">{s().topN}</span>
              <select
                class="select select-sm select-bordered w-auto"
                data-testid="share-topn"
                value={String(topN())}
                onInput={setTopNFromEvent}
                onChange={setTopNFromEvent}
              >
                {Array.from({ length: maxTopN() }, (_, i) => i + 1).map((n) => (
                  <option value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label class="flex items-center gap-2 whitespace-nowrap text-sm">
              <span class="whitespace-nowrap">{s().cycle}</span>
              <select
                class="select select-sm select-bordered w-auto"
                data-testid="share-cycle"
                value={shareCycle()}
                onInput={(e) => setShareCycle(e.currentTarget.value as Cycle)}
                onChange={(e) => setShareCycle(e.currentTarget.value as Cycle)}
              >
                {cycleOptions().map((c) => (
                  <option value={c}>{cycleName(c)}</option>
                ))}
              </select>
            </label>
            <label class="flex items-center gap-2 whitespace-nowrap text-sm">
              <span class="whitespace-nowrap">{s().language}</span>
              <select
                class="select select-sm select-bordered w-auto"
                data-testid="share-lang"
                value={shareLang()}
                onInput={(e) => setShareLang(e.currentTarget.value as Lang)}
                onChange={(e) => setShareLang(e.currentTarget.value as Lang)}
              >
                <option value="de">DE</option>
                <option value="en">EN</option>
              </select>
            </label>
            <div class="flex items-center gap-2 whitespace-nowrap text-sm">
              <span class="whitespace-nowrap">{s().theme}</span>
              <div class="join" data-testid="share-theme" role="group" aria-label={s().theme}>
                <button
                  type="button"
                  class="btn btn-sm join-item"
                  classList={{ "btn-primary btn-active": !dark() }}
                  onClick={() => setDark(false)}
                >
                  {s().light}
                </button>
                <button
                  type="button"
                  class="btn btn-sm join-item"
                  classList={{ "btn-primary btn-active": dark() }}
                  onClick={() => setDark(true)}
                >
                  {s().dark}
                </button>
              </div>
            </div>
            <label class="flex items-center gap-2 whitespace-nowrap text-sm">
              <span class="whitespace-nowrap">{s().size}</span>
              <select
                class="select select-sm select-bordered w-auto"
                data-testid="share-size"
                value={cardSize()}
                onInput={(e) => setCardSize(e.currentTarget.value as CardSize)}
                onChange={(e) => setCardSize(e.currentTarget.value as CardSize)}
              >
                <option value="og">OG</option>
                <option value="twitter">Twitter</option>
                <option value="ig45">IG 4:5</option>
                <option value="story">Story 9:16</option>
              </select>
            </label>
          </div>
          <div
            class="mt-4 flex max-h-[55vh] justify-center overflow-hidden rounded-lg border border-base-300 bg-base-300 p-4"
            data-testid="share-preview"
          >
            <img
              src={dataUrl()}
              alt={s().preview}
              width={dims().w}
              height={dims().h}
              class="rounded-md object-contain shadow-xl ring-1 ring-base-content/20"
              classList={{
                "max-h-[55vh] w-auto": isPortrait(),
                "h-auto max-h-[55vh] w-full": !isPortrait(),
              }}
              data-testid="share-preview-img"
            />
          </div>
          <div class="modal-action flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm" data-testid="share-copy-link" onClick={onCopy}>
              {copied() ? s().copied : s().copy}
            </button>
            <button type="button" class="btn btn-sm" data-testid="share-download-svg" onClick={onSvg}>
              {s().svg}
            </button>
            <button type="button" class="btn btn-sm" data-testid="share-download-png" onClick={onPng}>
              {s().png}
            </button>
            <form method="dialog">
              <button type="submit" class="btn btn-sm btn-ghost">
                {s().close}
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </>
  );
}

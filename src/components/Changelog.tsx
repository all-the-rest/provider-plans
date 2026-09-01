import { For, Show, createSignal, onMount } from "solid-js";
import type { ChangelogEntry, Lang, Translation } from "../types";
import Heading, { AnchorLink } from "./Heading";

export interface ChangelogProps {
  entries: ChangelogEntry[];
  t: Translation;
  lang: Lang;
}

const PAGE_SIZE = 20;

function entryTime(id: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/.exec(id);
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return date.toLocaleTimeString([], {
    timeZone: "Europe/Vienna",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function fmtDateOnly(iso: string, lang: Lang): string {
  const d = new Date(iso);
  // iso is YYYY-MM-DD, convert to date string at noon UTC to avoid timezone shift
  const date = new Date(`${iso}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default function Changelog(props: ChangelogProps) {
  const totalPages = () => Math.max(1, Math.ceil(props.entries.length / PAGE_SIZE));
  const [page, setPage] = createSignal(1);

  onMount(() => {
    const hash = window.location.hash.slice(1);
    const idx = props.entries.findIndex((e) => e.id === hash || e.date === hash);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
  });

  const clampedPage = () => Math.min(Math.max(1, page()), totalPages());
  const visibleEntries = () =>
    props.entries.slice((clampedPage() - 1) * PAGE_SIZE, clampedPage() * PAGE_SIZE);

  return (
    <section id="changelog" class="mt-10">
      <Heading anchor="changelog">{props.t.headingChangelog}</Heading>
      <Show
        when={props.entries.length > 0}
        fallback={<p class="mt-4 max-w-3xl text-sm leading-relaxed text-base-content/70">{props.t.chgNone}</p>}
      >
        <div class="mt-2 max-w-3xl text-sm leading-relaxed text-base-content/80">
          <For each={visibleEntries()}>
            {(entry) => (
              <div id={entry.id} class="mt-4 scroll-mt-24">
                <h3 class="text-sm font-semibold text-base-content/70">
                  {fmtDateOnly(entry.date, props.lang)}
                  <Show when={entryTime(entry.id) !== null}>
                    <span class="ml-2 font-normal text-base-content/50">{entryTime(entry.id)}</span>
                  </Show>
                  <AnchorLink id={entry.id} label="Direktlink zu diesem Changelog-Eintrag" />
                </h3>
                <Show when={entry.changes.length > 0} fallback={<p class="mt-1">{props.t.chgNone}</p>}>
                  <ul class="mt-1 space-y-1">
                    <For each={[...entry.changes].reverse()}>
                      {(ch) => (
                        <li class="flex items-center gap-2">
                          <span class="badge badge-sm badge-ghost shrink-0">i</span>
                          <span>{(ch as any)[props.lang]}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={totalPages() > 1}>
        <nav class="mt-6 flex items-center justify-center gap-2" aria-label="Changelog pagination">
          <button
            type="button"
            class="btn btn-sm"
            disabled={clampedPage() <= 1}
            onClick={() => setPage(clampedPage() - 1)}
          >
            ‹ {props.t.chgPrev}
          </button>
          <span class="text-sm text-base-content/60">
            {props.t.chgPage.replace("{page}", String(clampedPage())).replace("{total}", String(totalPages()))}
          </span>
          <button
            type="button"
            class="btn btn-sm"
            disabled={clampedPage() >= totalPages()}
            onClick={() => setPage(clampedPage() + 1)}
          >
            {props.t.chgNext} ›
          </button>
        </nav>
      </Show>
    </section>
  );
}

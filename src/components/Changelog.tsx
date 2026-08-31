import { createMemo, createSignal, For } from "solid-js";
import type { ChangelogEntry, Lang, Translation } from "../types";
import { fmtDate } from "../util";
import Heading from "./Heading";

export interface ChangelogProps {
  entries: ChangelogEntry[];
  t: Translation;
  lang: Lang;
}

const PAGE_SIZE = 5;

export default function Changelog(props: ChangelogProps) {
  const sorted = createMemo(() =>
    [...props.entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  );
  const total = createMemo(() => Math.max(1, Math.ceil(sorted().length / PAGE_SIZE)));
  const [page, setPage] = createSignal(1);
  const current = createMemo(() => {
    const c = page();
    const t = total();
    return c > t ? t : c < 1 ? 1 : c;
  });
  const visible = createMemo(() => {
    const start = (current() - 1) * PAGE_SIZE;
    return sorted().slice(start, start + PAGE_SIZE);
  });

  const go = (delta: number) => {
    const next = current() + delta;
    if (next >= 1 && next <= total()) setPage(next);
  };

  return (
    <section>
      <Heading anchor="changelog">{props.t.headingChangelog}</Heading>

      {sorted().length === 0 ? (
        <p class="mt-4 text-base-content/70">{props.t.chgNone}</p>
      ) : (
        <>
          <ul class="mt-4 grid gap-4">
            <For each={visible()}>
              {(entry) => (
                <li>
                  <article class="card card-border bg-base-100">
                    <div class="card-body gap-2 p-5">
                      <time class="badge badge-outline badge-sm w-fit tabular-nums" datetime={entry.date}>
                        {fmtDate(entry.date, props.lang)}
                      </time>
                      <ul class="grid gap-1.5 text-sm">
                        <For each={entry.changes}>
                          {(ch) => (
                            <li class="flex gap-2">
                              <span class="mt-0.5 text-base-content/40" aria-hidden="true">
                                •
                              </span>
                              <span>{ch[props.lang]}</span>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  </article>
                </li>
              )}
            </For>
          </ul>

          {sorted().length > PAGE_SIZE && (
            <div class="mt-6 flex items-center gap-3">
              <div class="join" role="group" aria-label={props.t.chgPage}>
                <button
                  type="button"
                  class="btn btn-sm join-item"
                  disabled={current() <= 1}
                  onClick={() => go(-1)}
                >
                  {props.t.chgPrev}
                </button>
                <span class="btn btn-sm join-item pointer-events-none" aria-disabled="true">
                  {props.t.chgPage.replace("{page}", String(current())).replace("{total}", String(total()))}
                </span>
                <button
                  type="button"
                  class="btn btn-sm join-item"
                  disabled={current() >= total()}
                  onClick={() => go(1)}
                >
                  {props.t.chgNext}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
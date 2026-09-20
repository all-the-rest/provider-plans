import { For } from "solid-js";
import type { FaqItem } from "../seo";
import Heading from "./Heading";

export interface FaqProps {
  heading: string;
  items: FaqItem[];
  anchor?: string;
}

/** Sichtbarer FAQ-Block (identische Inhalte wie die FAQPage-JSON-LD). */
export default function Faq(props: FaqProps) {
  return (
    <section class="mt-10">
      <Heading anchor={props.anchor ?? "faq"}>{props.heading}</Heading>
      <div class="mt-4 max-w-3xl divide-y divide-base-300 border-t border-base-300">
        <For each={props.items}>
          {(item) => (
            <details class="group py-3">
              <summary class="flex cursor-pointer list-none items-center gap-2 font-medium marker:content-none">
                <span
                  class="icon-[material-symbols--expand-more] h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
                <span>{item.q}</span>
              </summary>
              <p class="mt-2 pl-7 text-sm leading-relaxed text-base-content/80">{item.a}</p>
            </details>
          )}
        </For>
      </div>
    </section>
  );
}

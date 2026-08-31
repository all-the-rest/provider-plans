import type { Lang, Translation, VendorMeta } from "../types";

export interface FooterProps {
  t: Translation;
  lang: Lang;
  meta: VendorMeta;
}

export default function Footer(props: FooterProps) {
  const legalTitle = props.lang === "de" ? "Rechtliches" : "Legal";
  const priceLabel = props.lang === "de" ? "Preisliste" : "Price list";
  const patternUrl = "https://opencode.ai/docs/de/go/";

  return (
    <footer class="footer sm:footer-horizontal gap-y-8 bg-base-200 px-6 py-10 md:px-10">
      <nav class="max-w-sm">
        <h6 class="footer-title">{props.t.brand}</h6>
        <p>{props.t.footerNote}</p>
      </nav>
      <nav>
        <h6 class="footer-title">{props.t.sourceLink}</h6>
        <a href={props.meta.siteUrl} target="_blank" rel="noreferrer">
          {props.meta.name}
        </a>
        <a href={props.meta.priceSourceUrl} target="_blank" rel="noreferrer">
          {priceLabel}
        </a>
        <a href={patternUrl} target="_blank" rel="noreferrer">
          {props.t.sourcePattern}
        </a>
      </nav>
      <nav>
        <h6 class="footer-title">{legalTitle}</h6>
        <a href="/impressum">{props.t.impressum}</a>
        <a href="/datenschutz">{props.t.datenschutz}</a>
      </nav>
    </footer>
  );
}
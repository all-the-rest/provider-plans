import type { Lang } from "../types";

export interface ShareStrings {
  open: string;
  title: string;
  topN: string;
  cycle: string;
  language: string;
  theme: string;
  dark: string;
  light: string;
  copy: string;
  copied: string;
  svg: string;
  png: string;
  close: string;
  preview: string;
  size: string;
}

export const SHARE_STR: Record<Lang, ShareStrings> = {
  de: {
    open: "Teilen",
    title: "Plan teilen",
    topN: "Top-Modelle",
    cycle: "Zyklus",
    language: "Sprache",
    theme: "Theme",
    dark: "Dunkel",
    light: "Hell",
    copy: "Link kopieren",
    copied: "Kopiert!",
    svg: "SVG laden",
    png: "PNG laden",
    close: "Schließen",
    preview: "Vorschau",
    size: "Größe",
  },
  en: {
    open: "Share",
    title: "Share plan",
    topN: "Top models",
    cycle: "Cycle",
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    copy: "Copy link",
    copied: "Copied!",
    svg: "Download SVG",
    png: "Download PNG",
    close: "Close",
    preview: "Preview",
    size: "Size",
  },
};

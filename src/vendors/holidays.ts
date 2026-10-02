import type { HolidayCalendars } from "../types";
import raw from "./holidays.json";

/**
 * Feiertagskalender als **Handpflege-Konfiguration** (kein `chinese-days`/Generator in
 * diesem Repo — die Scraper-Repos `ocgo-price-tracker`/`cc-price-tracker` erzeugen ihren
 * Kalender selbst, hier wird dieselbe Datenlage als Konfiguration geführt).
 *
 * **Aktuell leer (`{}`):** Keine der gescrapten Vendor-Quellen nennt eine permanente
 * Feiertags-Off-Peak-Regel. Z.ai erwähnt „public holidays" nur in einem **temporären**
 * Kampagnen-Hinweis (`docs.z.ai/devpack/notice/event-glm-5.3-flash.md`, 03.09.–07.10.2026),
 * nicht in der Peak-Regel (`tests/fixtures/zai/overview.md:30`). Aus einer Kampagne wird
 * nichts abgeleitet (quellenbindend, wie in `ocgo`/`cc`). Die Konfiguration bleibt als
 * Erweiterungspunkt bestehen, damit die Datenform familienweit einheitlich bleibt; sobald
 * eine Quelle Feiertage nennt, wird hier ein Kalender (`{ dates, coveredThrough }`)
 * ergänzt und `PeakConfig.holidays` referenziert ihn.
 *
 * `coveredThrough` wäre ein ehrliches Datum (letzter abgedeckter Kalendertag), kein
 * Versprechen über die Zukunft.
 */
export const HOLIDAY_CALENDARS = raw as HolidayCalendars;

import {
  enUS,
  enGB,
  enAU,
  enCA,
  enNZ,
  enZA,
  enIE,
  enIN,
  de,
  deAT,
  fr,
  frCA,
  frCH,
  es,
  it,
  itCH,
  pt,
  ptBR,
  nl,
  nlBE,
  sv,
  nb,
  nn,
  da,
  fi,
  pl,
  ru,
  uk,
  ja,
  zhCN,
  zhTW,
  zhHK,
  ko,
  ar,
  arSA,
  arEG,
  hi,
  tr,
  vi,
  th,
  id,
  ms,
  he,
  el,
  hu,
  cs,
  sk,
  ro,
  bg,
  hr,
  sr,
  srLatn,
  sl,
  lt,
  lv,
  et,
} from "date-fns/locale";
import type { Locale } from "date-fns";

const LOCALE_MAP: Record<string, Locale> = {
  "en-us": enUS,
  "en-gb": enGB,
  "en-au": enAU,
  "en-ca": enCA,
  "en-nz": enNZ,
  "en-za": enZA,
  "en-ie": enIE,
  "en-in": enIN,
  de: de,
  "de-at": deAT,
  fr: fr,
  "fr-ca": frCA,
  "fr-ch": frCH,
  es: es,
  it: it,
  "it-ch": itCH,
  pt: pt,
  "pt-br": ptBR,
  nl: nl,
  "nl-be": nlBE,
  sv: sv,
  nb: nb,
  nn: nn,
  da: da,
  fi: fi,
  pl: pl,
  ru: ru,
  uk: uk,
  ja: ja,
  "zh-cn": zhCN,
  "zh-tw": zhTW,
  "zh-hk": zhHK,
  ko: ko,
  ar: ar,
  "ar-sa": arSA,
  "ar-eg": arEG,
  hi: hi,
  tr: tr,
  vi: vi,
  th: th,
  id: id,
  ms: ms,
  he: he,
  el: el,
  hu: hu,
  cs: cs,
  sk: sk,
  ro: ro,
  bg: bg,
  hr: hr,
  sr: sr,
  "sr-latn": srLatn,
  sl: sl,
  lt: lt,
  lv: lv,
  et: et,
};

export function getDateFnsLocale(): Locale {
  if (typeof navigator === "undefined") return enUS;
  const lang = navigator.language.toLowerCase();
  if (LOCALE_MAP[lang]) return LOCALE_MAP[lang];
  const base = lang.split("-")[0];
  if (LOCALE_MAP[base]) return LOCALE_MAP[base];
  return enUS;
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function oneYearAgoStr(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateForPicker(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateForApi(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const displayFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDateForDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return displayFormatter.format(new Date(y, m - 1, d));
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTimeForDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return dateTimeFormatter.format(d);
}

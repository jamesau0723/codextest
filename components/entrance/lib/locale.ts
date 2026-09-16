/**
 * Provisional-language resolution (spec 3, Scene 1).
 * Order: explicit supported URL locale, saved explicit preference,
 * browser preferences, English.
 */
import { LOCALES, DEFAULT_LOCALE, type Locale } from './content';

const TRADITIONAL_REGIONS = new Set(['TW', 'HK', 'MO']);
const SIMPLIFIED_REGIONS = new Set(['CN', 'SG']);

/** Normalise one BCP-47 tag to a supported locale, or null. */
export function normaliseTag(tag: string | null | undefined): Locale | null {
  if (typeof tag !== 'string' || tag.trim() === '') return null;
  const parts = tag.trim().replace(/_/g, '-').split('-');
  const language = (parts[0] || '').toLowerCase();

  if (language === 'en') return 'en';
  if (language !== 'zh') return null;

  // Script subtags are matched first: Hant -> Traditional, Hans -> Simplified.
  const script = parts.slice(1).find((part) => part.length === 4);
  if (script) {
    const lower = script.toLowerCase();
    if (lower === 'hant') return 'zh-Hant';
    if (lower === 'hans') return 'zh-Hans';
  }

  const region = parts
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part));
  if (region) {
    const upper = region.toUpperCase();
    if (TRADITIONAL_REGIONS.has(upper)) return 'zh-Hant';
    if (SIMPLIFIED_REGIONS.has(upper)) return 'zh-Hans';
  }

  // A bare `zh` falls back to Traditional as a product decision.
  return 'zh-Hant';
}

export function isSupported(locale: unknown): locale is Locale {
  return typeof locale === 'string' && (LOCALES as readonly string[]).includes(locale);
}

/** An explicit supported locale in the URL, or null. */
export function localeFromUrl(search = ''): Locale | null {
  const params = new URLSearchParams(search);
  for (const key of ['lang', 'locale', 'hl']) {
    const raw = params.get(key);
    if (!raw) continue;
    const exact = LOCALES.find((locale) => locale.toLowerCase() === raw.trim().toLowerCase());
    if (exact) return exact;
    const mapped = normaliseTag(raw);
    if (mapped) return mapped;
  }
  return null;
}

/** Walk the browser's language preferences in order. */
export function localeFromBrowser(languages?: readonly string[]): Locale | null {
  const list =
    Array.isArray(languages) && languages.length
      ? languages
      : typeof navigator !== 'undefined'
        ? (navigator.languages ?? [navigator.language]).filter(Boolean)
        : [];
  for (const tag of list) {
    const mapped = normaliseTag(tag);
    if (mapped) return mapped;
  }
  return null;
}

export type LocaleSource = 'url' | 'stored' | 'browser' | 'default';

/** Resolve the provisional locale used before an explicit selection. */
export function resolveProvisionalLocale({
  saved = null,
  search,
  languages
}: {
  saved?: string | null;
  search?: string;
  languages?: readonly string[];
} = {}): { locale: Locale; source: LocaleSource } {
  const fromUrl = localeFromUrl(
    search ?? (typeof location !== 'undefined' ? location.search : '')
  );
  if (fromUrl) return { locale: fromUrl, source: 'url' };
  if (isSupported(saved)) return { locale: saved, source: 'stored' };
  const fromBrowser = localeFromBrowser(languages);
  if (fromBrowser) return { locale: fromBrowser, source: 'browser' };
  return { locale: DEFAULT_LOCALE, source: 'default' };
}

/** Keep the chosen locale in the URL so links and reloads preserve it. */
export function syncLocaleToUrl(locale: Locale): void {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  try {
    const url = new URL(location.href);
    url.searchParams.set('lang', locale);
    history.replaceState(history.state, '', url);
  } catch {
    /* Routing is best-effort; never break the entrance over it. */
  }
}

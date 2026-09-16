/**
 * Provisional-language resolution (spec 3, Scene 1) and locale propagation.
 *
 * Order: explicit supported URL locale, saved explicit preference,
 * browser preferences, English.
 */
import { LOCALES, DEFAULT_LOCALE, COPY } from './EntranceContentData.js';

const TRADITIONAL_REGIONS = new Set(['TW', 'HK', 'MO']);
const SIMPLIFIED_REGIONS = new Set(['CN', 'SG']);

/** Normalise one BCP-47 tag to a supported locale, or null. */
export function normaliseTag(tag) {
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

  // No script tag: fall back to region.
  const region = parts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part));
  if (region) {
    const upper = region.toUpperCase();
    if (TRADITIONAL_REGIONS.has(upper)) return 'zh-Hant';
    if (SIMPLIFIED_REGIONS.has(upper)) return 'zh-Hans';
  }

  // A bare `zh` falls back to Traditional as a product decision.
  return 'zh-Hant';
}

export function isSupported(locale) {
  return LOCALES.includes(locale);
}

/** An explicit supported locale in the URL, or null. */
export function localeFromUrl(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search);
  for (const key of ['lang', 'locale', 'hl']) {
    const raw = params.get(key);
    if (!raw) continue;
    // Only an explicit *supported* locale counts; `?lang=fr` is not a match.
    const exact = LOCALES.find((locale) => locale.toLowerCase() === raw.trim().toLowerCase());
    if (exact) return exact;
    const mapped = normaliseTag(raw);
    if (mapped) return mapped;
  }
  return null;
}

/** Walk the browser's language preferences in order. */
export function localeFromBrowser(languages = globalThis.navigator?.languages) {
  const list = Array.isArray(languages) && languages.length
    ? languages
    : [globalThis.navigator?.language].filter(Boolean);
  for (const tag of list) {
    const mapped = normaliseTag(tag);
    if (mapped) return mapped;
  }
  return null;
}

/**
 * Resolve the provisional locale used before an explicit selection.
 * `saved` is the stored explicit preference (or null).
 */
export function resolveProvisionalLocale({ saved = null, search, languages } = {}) {
  const fromUrl = localeFromUrl(search);
  if (fromUrl) return { locale: fromUrl, source: 'url' };
  if (isSupported(saved)) return { locale: saved, source: 'stored' };
  const fromBrowser = localeFromBrowser(languages);
  if (fromBrowser) return { locale: fromBrowser, source: 'browser' };
  return { locale: DEFAULT_LOCALE, source: 'default' };
}

/** Apply a locale to the document: html lang, dataset, and localized site copy. */
export function applyLocaleToDocument(locale, doc = globalThis.document) {
  if (!doc) return;
  const copy = COPY[locale] || COPY[DEFAULT_LOCALE];
  doc.documentElement.setAttribute('lang', copy.htmlLang);
  doc.documentElement.dataset.locale = locale;
  for (const node of doc.querySelectorAll('[data-i18n]')) {
    const key = node.dataset.i18n;
    const value = node.dataset[localeDatasetKey(locale)] ?? node.dataset.en;
    if (typeof value === 'string' && value !== '') {
      node.textContent = value;
    } else if (key && copy[key]) {
      node.textContent = copy[key];
    }
    if (locale === 'en') node.removeAttribute('lang');
    else node.setAttribute('lang', copy.htmlLang);
  }
  doc.dispatchEvent(new CustomEvent('dfestival:localechange', { detail: { locale } }));
}

function localeDatasetKey(locale) {
  if (locale === 'zh-Hant') return 'hant';
  if (locale === 'zh-Hans') return 'hans';
  return 'en';
}

/** Keep the chosen locale in the URL so links and reloads preserve it. */
export function syncLocaleToUrl(locale, history = globalThis.history, loc = globalThis.location) {
  if (!history || !loc) return;
  try {
    const url = new URL(loc.href);
    url.searchParams.set('lang', locale);
    history.replaceState(history.state, '', url);
  } catch {
    /* Routing is best-effort; never break the entrance over it. */
  }
}

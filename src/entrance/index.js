/**
 * Entrance bootstrap: eligibility, routing and Replay (spec 9).
 *
 * The entrance shows automatically only on an eligible homepage first visit
 * with no saved outcome. Deep links always open their target untouched.
 */
import { EntranceController } from './EntranceController.js';
import { resolveProvisionalLocale, applyLocaleToDocument } from './locale.js';
import { readLocale, readOutcome, clearOutcome } from './storage.js';

const HOMEPAGE_PATHS = new Set(['/', '/index.html', '/index']);

let activeController = null;

export function isHomepage(pathname = globalThis.location?.pathname || '/') {
  return HOMEPAGE_PATHS.has(pathname);
}

/**
 * A deep link is any non-homepage route. Those bypass the entrance entirely
 * and keep their requested target.
 */
export function shouldAutoShow({ pathname, outcome, forced } = {}) {
  if (forced) return true;
  if (!isHomepage(pathname)) return false;
  return outcome === null;
}

export function currentLocale() {
  const { locale } = resolveProvisionalLocale({ saved: readLocale() });
  return locale;
}

/**
 * @param {object} [options]
 * @param {boolean} [options.force]   show regardless of saved outcome (Replay)
 * @param {object}  [options.media]   media override (tests)
 * @param {boolean} [options.reducedMotion]
 * @param {HTMLElement} [options.returnFocusTo]
 */
export function openEntrance(options = {}) {
  if (activeController) return activeController;

  const mount = document.getElementById('entrance-root');
  const siteRoot = document.getElementById('site-root');
  if (!mount) return null;

  // Replay uses the saved language as provisional and still permits a choice.
  const locale = options.locale || currentLocale();
  applyLocaleToDocument(locale);

  activeController = new EntranceController({
    mount,
    siteRoot,
    locale,
    media: options.media,
    reducedMotion: options.reducedMotion,
    returnFocusTo: options.returnFocusTo || null,
    onExit: (outcome, context) => {
      const returnTo = options.returnFocusTo;
      activeController = null;
      document.documentElement.dataset.entrance = outcome;
      if (returnTo && document.contains(returnTo)) {
        // A replay returns focus to its launching control.
        returnTo.focus({ preventScroll: false });
      } else {
        // Normal entry moves focus into the homepage main content.
        const main = document.getElementById('main-content');
        if (main) {
          main.tabIndex = -1;
          main.focus({ preventScroll: true });
        }
      }
      document.dispatchEvent(
        new CustomEvent('dfestival:entranceclosed', { detail: { outcome, ...context } })
      );
      options.onExit?.(outcome, context);
    }
  });

  return activeController;
}

export function getActiveEntrance() {
  return activeController;
}

/** Wire the footer Replay control and auto-show on an eligible first visit. */
export function initEntrance({ media, force } = {}) {
  const params = new URLSearchParams(globalThis.location.search);
  const forced = force ?? params.get('entrance') === 'replay';
  const outcome = readOutcome();

  // Locale still applies to the page even when the entrance does not show.
  applyLocaleToDocument(currentLocale());

  for (const trigger of document.querySelectorAll('[data-action="replay-entrance"]')) {
    trigger.hidden = false;
    trigger.addEventListener('click', () => {
      // Replay does not change the saved outcome until a new exit is committed.
      openEntrance({ media, returnFocusTo: trigger });
    });
  }

  if (shouldAutoShow({ pathname: globalThis.location.pathname, outcome, forced })) {
    openEntrance({ media });
  } else {
    document.documentElement.dataset.entrance = outcome || 'bypassed';
  }
}

export { clearOutcome };

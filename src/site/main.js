/**
 * Site bootstrap. Keeps the entrance an optional invitation: if this module
 * fails to load or throws, the website below is already usable.
 */
import { initEntrance, openEntrance } from '../entrance/index.js';

function readTestMediaOverride() {
  // Test seam only: lets automation run the entrance against fixture media
  // without editing the production media configuration.
  try {
    const raw = new URLSearchParams(location.search).get('media');
    if (!raw) return undefined;
    if (raw === 'none') return { master: { src: null, poster: null } };
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return undefined;
  }
}

try {
  initEntrance({ media: readTestMediaOverride() });
} catch (error) {
  // Initialisation failure must leave the homepage working, not blocked.
  console.error('[d-festival] entrance initialisation failed', error);
  document.documentElement.dataset.entrance = 'failed';
  for (const node of document.querySelectorAll('#entrance-root .d-entrance')) {
    node.remove();
  }
  document.body.style.overflow = '';
}

// Exposed for tests and for any later in-page trigger.
globalThis.DFestival = { openEntrance };

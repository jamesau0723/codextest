/**
 * Persistence (spec 9). Storage may be unavailable or blocked; the entrance
 * must still work, falling back to in-memory values without throwing.
 */

export const KEYS = {
  locale: 'dFestival.locale',
  outcome: 'dFestival.entranceOutcome',
  version: 'dFestival.entranceVersion'
};

export const ENTRANCE_VERSION = '2.0';

const memory = new Map();
let storageWorks = null;

function backing() {
  if (storageWorks === null) {
    try {
      const probe = '__dfestival_probe__';
      globalThis.localStorage.setItem(probe, '1');
      globalThis.localStorage.removeItem(probe);
      storageWorks = true;
    } catch {
      storageWorks = false;
    }
  }
  return storageWorks ? globalThis.localStorage : null;
}

export function storageAvailable() {
  return backing() !== null;
}

export function read(key) {
  const store = backing();
  if (store) {
    try {
      const value = store.getItem(key);
      if (value !== null) return value;
    } catch {
      /* fall through to memory */
    }
  }
  return memory.has(key) ? memory.get(key) : null;
}

export function write(key, value) {
  memory.set(key, value);
  const store = backing();
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readLocale() {
  return read(KEYS.locale);
}

export function writeLocale(locale) {
  return write(KEYS.locale, locale);
}

/** `completed` (explicit Enter D) or `skipped` (committed skip), else null. */
export function readOutcome() {
  const outcome = read(KEYS.outcome);
  return outcome === 'completed' || outcome === 'skipped' ? outcome : null;
}

export function writeOutcome(outcome) {
  write(KEYS.version, ENTRANCE_VERSION);
  return write(KEYS.outcome, outcome);
}

/** Reset only for an explicit replay request; never on a copy/design bump. */
export function clearOutcome() {
  memory.delete(KEYS.outcome);
  const store = backing();
  if (!store) return;
  try {
    store.removeItem(KEYS.outcome);
  } catch {
    /* ignore */
  }
}

/** Test seam. */
export function __resetForTests() {
  memory.clear();
  storageWorks = null;
}

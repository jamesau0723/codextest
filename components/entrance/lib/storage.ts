/**
 * Persistence (spec 9). Storage may be unavailable or blocked; the entrance
 * must still work, falling back to in-memory values without throwing.
 */
import type { Locale } from './content';

export const KEYS = {
  locale: 'dFestival.locale',
  outcome: 'dFestival.entranceOutcome',
  version: 'dFestival.entranceVersion'
} as const;

export const ENTRANCE_VERSION = '2.0';

export type Outcome = 'completed' | 'skipped';

const memory = new Map<string, string>();
let storageWorks: boolean | null = null;

function backing(): Storage | null {
  if (typeof window === 'undefined') return null;
  if (storageWorks === null) {
    try {
      const probe = '__dfestival_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      storageWorks = true;
    } catch {
      storageWorks = false;
    }
  }
  return storageWorks ? window.localStorage : null;
}

export function storageAvailable(): boolean {
  return backing() !== null;
}

export function read(key: string): string | null {
  const store = backing();
  if (store) {
    try {
      const value = store.getItem(key);
      if (value !== null) return value;
    } catch {
      /* fall through to memory */
    }
  }
  return memory.has(key) ? (memory.get(key) as string) : null;
}

export function write(key: string, value: string): boolean {
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

export function readLocale(): string | null {
  return read(KEYS.locale);
}

export function writeLocale(locale: Locale): boolean {
  return write(KEYS.locale, locale);
}

/** `completed` (explicit Enter D) or `skipped` (committed skip), else null. */
export function readOutcome(): Outcome | null {
  const outcome = read(KEYS.outcome);
  return outcome === 'completed' || outcome === 'skipped' ? outcome : null;
}

export function writeOutcome(outcome: Outcome): boolean {
  write(KEYS.version, ENTRANCE_VERSION);
  return write(KEYS.outcome, outcome);
}

export function clearOutcome(): void {
  memory.delete(KEYS.outcome);
  const store = backing();
  if (!store) return;
  try {
    store.removeItem(KEYS.outcome);
  } catch {
    /* ignore */
  }
}

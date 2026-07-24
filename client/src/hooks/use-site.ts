import { useCallback, useSyncExternalStore } from 'react';

/**
 * Where the user's last successful location search originated.
 * `label` is "your current location" or a ZIP like "19103";
 * `distanceMiles` is the whole-mile distance to the selected site.
 */
export type SiteOrigin = { label: string; distanceMiles: number };

type StoredSite = { key: string; label: string; origin?: SiteOrigin };

const STORAGE_KEY = 'iw_site';

function readStored(): StoredSite | null {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

// ---- Module-level shared store -------------------------------------------
// A single canonical selected-site value shared by every useSiteStorage()
// instance. Previously each hook call held its own useState seeded from
// localStorage, so components (e.g. the map vs. the landing page) could
// disagree about the selected city until a remount.
let current: StoredSite | null = readStored();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoredSite | null {
  return current;
}

/** Update the canonical site, persist it, and notify every subscriber. */
function setSiteShared(key: string, label: string, origin?: SiteOrigin) {
  const data: StoredSite = { key, label, ...(origin ? { origin } : {}) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Persisting is best-effort; in-memory state is still the source of truth.
  }
  current = data;
  emit();
}

// Keep tabs in sync: another tab's selection updates this one too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    current = readStored();
    emit();
  });
}

export function useSiteStorage() {
  const site = useSyncExternalStore(subscribe, getSnapshot);

  const setSite = useCallback((key: string, label: string, origin?: SiteOrigin) => {
    setSiteShared(key, label, origin);
  }, []);

  return { site, setSite };
}

import { useState, useCallback } from 'react';

/**
 * Where the user's last successful location search originated.
 * `label` is "your current location" or a ZIP like "19103";
 * `distanceMiles` is the whole-mile distance to the selected site.
 */
export type SiteOrigin = { label: string; distanceMiles: number };

type StoredSite = { key: string; label: string; origin?: SiteOrigin };

export function useSiteStorage() {
  const [site, setSiteInternal] = useState<StoredSite | null>(() => {
    try {
      const item = localStorage.getItem('iw_site');
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  });

  const setSite = useCallback((key: string, label: string, origin?: SiteOrigin) => {
    const data: StoredSite = { key, label, ...(origin ? { origin } : {}) };
    localStorage.setItem('iw_site', JSON.stringify(data));
    setSiteInternal(data);
  }, []);

  return { site, setSite };
}

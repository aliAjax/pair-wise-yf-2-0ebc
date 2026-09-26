import type { Bench } from '@/types';

const STORAGE_KEY = 'bench-archive-data';

function migrateBench(raw: Bench): Bench {
  return {
    ...raw,
    experiences: raw.experiences ?? [],
    noiseSamples: raw.noiseSamples ?? [],
    noiseUpdatedAt: raw.noiseUpdatedAt ?? raw.updatedAt ?? raw.createdAt,
  };
}

export function loadBenches(): Bench[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map(migrateBench);
      }
    }
  } catch (error) {
    console.error('Failed to load benches from localStorage:', error);
  }
  return [];
}

export function saveBenches(benches: Bench[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(benches));
  } catch (error) {
    console.error('Failed to save benches to localStorage:', error);
  }
}

export function clearBenches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear benches from localStorage:', error);
  }
}

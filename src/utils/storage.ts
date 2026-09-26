import type { Bench, TimePeriodType } from '@/types';
import { normalizeBenches } from '@/utils/noise';

const STORAGE_KEY = 'bench-archive-data';
const PERIOD_KEY = 'bench-archive-noise-period';

export function loadBenches(): Bench[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return normalizeBenches(JSON.parse(data));
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

export function loadSelectedPeriod(): TimePeriodType | null {
  try {
    const value = localStorage.getItem(PERIOD_KEY);
    if (value === 'morning' || value === 'noon' || value === 'afternoon' || value === 'evening' || value === 'night') {
      return value;
    }
  } catch (error) {
    console.error('Failed to load selected period from localStorage:', error);
  }
  return null;
}

export function saveSelectedPeriod(period: TimePeriodType | null): void {
  try {
    if (period) {
      localStorage.setItem(PERIOD_KEY, period);
    } else {
      localStorage.removeItem(PERIOD_KEY);
    }
  } catch (error) {
    console.error('Failed to save selected period to localStorage:', error);
  }
}

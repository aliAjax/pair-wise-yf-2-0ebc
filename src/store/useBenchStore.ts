import { create } from 'zustand';
import type { Bench, BenchExperience, MaterialType, OrientationType, ShadeLevelType, NoiseLevelType, TimePeriodType, NoiseSample } from '@/types';
import { loadBenches, saveBenches, loadSelectedPeriod, saveSelectedPeriod } from '@/utils/storage';
import { generateId } from '@/utils/comfort';
import { getEffectiveNoise, getNoiseUpdatedDate, pruneNoiseSamples } from '@/utils/noise';
import { mockBenches } from '@/data/mockBenches';

export type NoiseSampleResult = { ok: true } | { ok: false; reason: 'stale' };

interface BenchState {
  benches: Bench[];
  searchQuery: string;
  materialFilter: MaterialType | null;
  orientationFilter: OrientationType | null;
  shadeFilter: ShadeLevelType | null;
  noiseFilter: NoiseLevelType | null;
  selectedPeriod: TimePeriodType | null;
  initialized: boolean;
}

interface BenchActions {
  initialize: () => void;
  setSearchQuery: (query: string) => void;
  setMaterialFilter: (material: MaterialType | null) => void;
  setOrientationFilter: (orientation: OrientationType | null) => void;
  setShadeFilter: (shade: ShadeLevelType | null) => void;
  setNoiseFilter: (noise: NoiseLevelType | null) => void;
  setSelectedPeriod: (period: TimePeriodType | null) => void;
  clearFilters: () => void;
  addBench: (bench: Omit<Bench, 'id' | 'createdAt' | 'updatedAt' | 'experiences' | 'noiseSamples' | 'noiseUpdatedAt'>) => void;
  updateBench: (id: string, updates: Partial<Bench>) => void;
  deleteBench: (id: string) => void;
  getBenchById: (id: string) => Bench | undefined;
  addExperience: (benchId: string, experience: Omit<BenchExperience, 'id' | 'benchId'>) => void;
  updateExperience: (benchId: string, expId: string, updates: Partial<BenchExperience>) => void;
  deleteExperience: (benchId: string, expId: string) => void;
  addNoiseSample: (benchId: string, sample: Omit<NoiseSample, 'id'>) => NoiseSampleResult;
  deleteNoiseSample: (benchId: string, sampleId: string) => void;
  getFilteredBenches: () => Bench[];
}

const initialState: BenchState = {
  benches: [],
  searchQuery: '',
  materialFilter: null,
  orientationFilter: null,
  shadeFilter: null,
  noiseFilter: null,
  selectedPeriod: loadSelectedPeriod(),
  initialized: false,
};

export const useBenchStore = create<BenchState & BenchActions>((set, get) => ({
  ...initialState,

  initialize: () => {
    const stored = loadBenches();
    if (stored.length > 0) {
      set({ benches: stored, initialized: true });
    } else {
      set({ benches: mockBenches, initialized: true });
      saveBenches(mockBenches);
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setMaterialFilter: (material) => set({ materialFilter: material }),
  setOrientationFilter: (orientation) => set({ orientationFilter: orientation }),
  setShadeFilter: (shade) => set({ shadeFilter: shade }),
  setNoiseFilter: (noise) => set({ noiseFilter: noise }),
  setSelectedPeriod: (period) => {
    set({ selectedPeriod: period });
    saveSelectedPeriod(period);
  },

  clearFilters: () => set({
    searchQuery: '',
    materialFilter: null,
    orientationFilter: null,
    shadeFilter: null,
    noiseFilter: null,
  }),

  addBench: (benchData) => {
    const now = new Date().toISOString();
    const newBench: Bench = {
      ...benchData,
      id: generateId(),
      experiences: [],
      noiseSamples: [],
      noiseUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const newBenches = [newBench, ...get().benches];
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  updateBench: (id, updates) => {
    const now = new Date().toISOString();
    const newBenches = get().benches.map((bench) => {
      if (bench.id !== id) return bench;
      const merged = { ...bench, ...updates, updatedAt: now };
      // 噪音等级变动：记录更新时间，并同步清理旧的分时段样本
      if (updates.noiseLevel !== undefined && updates.noiseLevel !== bench.noiseLevel) {
        merged.noiseUpdatedAt = now;
        merged.noiseSamples = [];
      } else {
        merged.noiseSamples = bench.noiseSamples || [];
        merged.noiseUpdatedAt = bench.noiseUpdatedAt || bench.updatedAt || bench.createdAt;
      }
      return merged;
    });
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  deleteBench: (id) => {
    const newBenches = get().benches.filter((bench) => bench.id !== id);
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  getBenchById: (id) => {
    return get().benches.find((bench) => bench.id === id);
  },

  addExperience: (benchId, experienceData) => {
    const newExperience: BenchExperience = {
      ...experienceData,
      id: generateId(),
      benchId,
    };
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            experiences: [...bench.experiences, newExperience],
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  updateExperience: (benchId, expId, updates) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            experiences: bench.experiences.map((exp) =>
              exp.id === expId ? { ...exp, ...updates } : exp
            ),
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  deleteExperience: (benchId, expId) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            experiences: bench.experiences.filter((exp) => exp.id !== expId),
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  addNoiseSample: (benchId, sampleData) => {
    const bench = get().benches.find((b) => b.id === benchId);
    if (!bench) return { ok: false, reason: 'stale' };

    // 采样日早于噪音字段更新日的不收
    const noiseUpdatedDate = getNoiseUpdatedDate(bench);
    if (sampleData.sampledAt < noiseUpdatedDate) {
      return { ok: false, reason: 'stale' };
    }

    const newSample: NoiseSample = { ...sampleData, id: generateId() };
    const newBenches = get().benches.map((b) => {
      if (b.id !== benchId) return b;
      // 同一时段只保留最近一次
      const kept = (b.noiseSamples || []).filter((s) => s.timePeriod !== sampleData.timePeriod);
      return {
        ...b,
        noiseSamples: pruneNoiseSamples([...kept, newSample], noiseUpdatedDate),
        updatedAt: new Date().toISOString(),
      };
    });
    set({ benches: newBenches });
    saveBenches(newBenches);
    return { ok: true };
  },

  deleteNoiseSample: (benchId, sampleId) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            noiseSamples: (bench.noiseSamples || []).filter((s) => s.id !== sampleId),
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  getFilteredBenches: () => {
    const { benches, searchQuery, materialFilter, orientationFilter, shadeFilter, noiseFilter, selectedPeriod } = get();

    return benches.filter((bench) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = bench.name.toLowerCase().includes(query);
        const matchLocation = bench.location.toLowerCase().includes(query);
        const matchReview = bench.review.toLowerCase().includes(query);
        if (!matchName && !matchLocation && !matchReview) return false;
      }

      if (materialFilter && bench.material !== materialFilter) return false;
      if (orientationFilter && bench.orientation !== orientationFilter) return false;
      if (shadeFilter && bench.shadeLevel !== shadeFilter) return false;
      // 按所选时段的有效噪音过滤，缺样本时沿用原噪音字段
      if (noiseFilter && getEffectiveNoise(bench, selectedPeriod) !== noiseFilter) return false;

      return true;
    });
  },
}));

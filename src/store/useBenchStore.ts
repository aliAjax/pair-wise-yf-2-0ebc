import { create } from 'zustand';
import type { Bench, BenchExperience, MaterialType, OrientationType, ShadeLevelType, NoiseLevelType, TimePeriodType, NoiseSample, AddNoiseSampleResult } from '@/types';
import { loadBenches, saveBenches } from '@/utils/storage';
import { generateId, getEffectiveNoiseLevel } from '@/utils/comfort';
import { dateStringOf } from '@/utils/date';
import { mockBenches } from '@/data/mockBenches';

interface BenchState {
  benches: Bench[];
  searchQuery: string;
  materialFilter: MaterialType | null;
  orientationFilter: OrientationType | null;
  shadeFilter: ShadeLevelType | null;
  noiseFilter: NoiseLevelType | null;
  selectedTimePeriod: TimePeriodType | null;
  initialized: boolean;
}

interface BenchActions {
  initialize: () => void;
  setSearchQuery: (query: string) => void;
  setMaterialFilter: (material: MaterialType | null) => void;
  setOrientationFilter: (orientation: OrientationType | null) => void;
  setShadeFilter: (shade: ShadeLevelType | null) => void;
  setNoiseFilter: (noise: NoiseLevelType | null) => void;
  setSelectedTimePeriod: (period: TimePeriodType | null) => void;
  clearFilters: () => void;
  addBench: (bench: Omit<Bench, 'id' | 'createdAt' | 'updatedAt' | 'experiences' | 'noiseUpdatedAt' | 'noiseSamples'>) => void;
  updateBench: (id: string, updates: Partial<Bench>) => void;
  deleteBench: (id: string) => void;
  getBenchById: (id: string) => Bench | undefined;
  addExperience: (benchId: string, experience: Omit<BenchExperience, 'id' | 'benchId'>) => void;
  updateExperience: (benchId: string, expId: string, updates: Partial<BenchExperience>) => void;
  deleteExperience: (benchId: string, expId: string) => void;
  addNoiseSample: (benchId: string, sample: NoiseSample) => AddNoiseSampleResult;
  deleteNoiseSample: (benchId: string, timePeriod: TimePeriodType) => void;
  getFilteredBenches: () => Bench[];
}

const initialState: BenchState = {
  benches: [],
  searchQuery: '',
  materialFilter: null,
  orientationFilter: null,
  shadeFilter: null,
  noiseFilter: null,
  selectedTimePeriod: null,
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
  setSelectedTimePeriod: (period) => set({ selectedTimePeriod: period }),

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
      noiseUpdatedAt: now,
      noiseSamples: [],
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
      // 噪音等级变动时，旧的时段样本同步失效清理
      const noiseChanged = updates.noiseLevel !== undefined && updates.noiseLevel !== bench.noiseLevel;
      return {
        ...bench,
        ...updates,
        ...(noiseChanged ? { noiseUpdatedAt: now, noiseSamples: [] } : {}),
        updatedAt: now,
      };
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

  addNoiseSample: (benchId, sample) => {
    const bench = get().benches.find((b) => b.id === benchId);
    if (!bench) return 'bench-missing';

    // 采样日早于噪音字段更新日的样本不收
    const noiseUpdatedDate = dateStringOf(bench.noiseUpdatedAt);
    if (noiseUpdatedDate && sample.sampleDate < noiseUpdatedDate) {
      return 'rejected-stale';
    }

    const samples = bench.noiseSamples ?? [];
    const existing = samples.find((s) => s.timePeriod === sample.timePeriod);
    // 同一时段只保留最近一次采样
    if (existing && existing.sampleDate > sample.sampleDate) {
      return 'kept-newer';
    }

    const newSamples = [
      ...samples.filter((s) => s.timePeriod !== sample.timePeriod),
      sample,
    ];
    const newBenches = get().benches.map((b) =>
      b.id === benchId ? { ...b, noiseSamples: newSamples } : b
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
    return existing ? 'replaced' : 'added';
  },

  deleteNoiseSample: (benchId, timePeriod) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            noiseSamples: (bench.noiseSamples ?? []).filter((s) => s.timePeriod !== timePeriod),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  getFilteredBenches: () => {
    const { benches, searchQuery, materialFilter, orientationFilter, shadeFilter, noiseFilter, selectedTimePeriod } = get();

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
      // 选了时段时按该时段的有效噪音筛选，缺样本沿用原字段
      if (noiseFilter && getEffectiveNoiseLevel(bench, selectedTimePeriod) !== noiseFilter) return false;

      return true;
    });
  },
}));

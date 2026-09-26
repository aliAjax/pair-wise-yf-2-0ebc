import type { Bench, NoiseLevelType, NoiseSample, TimePeriodType } from '@/types';

/** 噪音字段的基准日期（YYYY-MM-DD）：分时段样本的采样日不得早于它 */
export function getNoiseUpdatedDate(bench: Bench): string {
  const iso = bench.noiseUpdatedAt || bench.updatedAt || bench.createdAt;
  return (iso || '').slice(0, 10);
}

/** 取某时段最近一次样本（同日期保留后出现的一条） */
export function getNoiseSample(bench: Bench, period: TimePeriodType): NoiseSample | undefined {
  const samples = bench.noiseSamples || [];
  let latest: NoiseSample | undefined;
  for (const sample of samples) {
    if (sample.timePeriod !== period) continue;
    if (!latest || sample.sampledAt >= latest.sampledAt) {
      latest = sample;
    }
  }
  return latest;
}

/** 按时段取有效噪音：该时段缺样本时沿用原噪音字段 */
export function getEffectiveNoise(bench: Bench, period?: TimePeriodType | null): NoiseLevelType {
  if (!period) return bench.noiseLevel;
  return getNoiseSample(bench, period)?.level ?? bench.noiseLevel;
}

/** 清理过期样本：采样日早于噪音字段更新日的不收；同一时段只保留最近一次 */
export function pruneNoiseSamples(samples: NoiseSample[] | undefined, noiseUpdatedDate: string): NoiseSample[] {
  const byPeriod = new Map<TimePeriodType, NoiseSample>();
  for (const sample of samples || []) {
    if (!sample.sampledAt || sample.sampledAt < noiseUpdatedDate) continue;
    const existing = byPeriod.get(sample.timePeriod);
    if (!existing || sample.sampledAt >= existing.sampledAt) {
      byPeriod.set(sample.timePeriod, sample);
    }
  }
  return Array.from(byPeriod.values());
}

/** 兼容旧数据：补齐噪音字段更新时间，并顺带清理过期样本 */
export function normalizeBench(bench: Bench): Bench {
  const noiseUpdatedAt = bench.noiseUpdatedAt || bench.updatedAt || bench.createdAt;
  return {
    ...bench,
    noiseUpdatedAt,
    noiseSamples: pruneNoiseSamples(bench.noiseSamples, getNoiseUpdatedDate({ ...bench, noiseUpdatedAt })),
  };
}

export function normalizeBenches(benches: Bench[]): Bench[] {
  return benches.map(normalizeBench);
}

/** 噪音等级对应的徽标样式 */
export function getNoiseBadgeClass(level: NoiseLevelType): string {
  if (level === 'quiet') return 'bg-moss-green/10 text-moss-green';
  if (level === 'moderate') return 'bg-ochre/10 text-ochre';
  return 'bg-red-500/10 text-red-500';
}

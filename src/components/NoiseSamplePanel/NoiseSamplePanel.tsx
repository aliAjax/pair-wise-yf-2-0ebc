import { useState } from 'react';
import { Sunrise, Sun, CloudSun, Sunset, Moon, Plus, Pencil, Trash2, X, Save, Volume2, CalendarDays, Info } from 'lucide-react';
import { useBenchStore } from '@/store/useBenchStore';
import { TIME_PERIODS, TIME_PERIOD_LABELS, NOISE_LABELS } from '@/types';
import type { Bench, TimePeriodType, NoiseLevelType } from '@/types';
import { getNoiseSample, getNoiseUpdatedDate, getNoiseBadgeClass } from '@/utils/noise';

const PERIOD_ICONS: Record<TimePeriodType, typeof Sunrise> = {
  morning: Sunrise,
  noon: Sun,
  afternoon: CloudSun,
  evening: Sunset,
  night: Moon,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface NoiseSamplePanelProps {
  bench: Bench;
}

export default function NoiseSamplePanel({ bench }: NoiseSamplePanelProps) {
  const addNoiseSample = useBenchStore((s) => s.addNoiseSample);
  const deleteNoiseSample = useBenchStore((s) => s.deleteNoiseSample);

  const [editingPeriod, setEditingPeriod] = useState<TimePeriodType | null>(null);
  const [level, setLevel] = useState<NoiseLevelType>('quiet');
  const [sampledAt, setSampledAt] = useState(today());
  const [error, setError] = useState('');

  const minDate = getNoiseUpdatedDate(bench);

  const startEdit = (period: TimePeriodType) => {
    const existing = getNoiseSample(bench, period);
    setEditingPeriod(period);
    setLevel(existing?.level ?? bench.noiseLevel);
    setSampledAt(existing?.sampledAt ?? today());
    setError('');
  };

  const handleSave = () => {
    if (!editingPeriod) return;
    if (!sampledAt) {
      setError('请选择采样日期');
      return;
    }
    const result = addNoiseSample(bench.id, { timePeriod: editingPeriod, level, sampledAt });
    if (!result.ok) {
      setError(`采样日期早于整体噪音更新日（${minDate}），该样本不收`);
      return;
    }
    setEditingPeriod(null);
    setError('');
  };

  return (
    <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-2">
      <div className="flex items-center gap-2 mb-1">
        <Volume2 className="w-4 h-4 text-ochre" />
        <h2 className="font-serif text-lg font-semibold text-deep-brown">
          分时段噪音样本
        </h2>
      </div>
      <p className="text-xs text-ink-light/70 mb-4">
        同一时段只保留最近一次采样；缺样本的时段沿用整体噪音「{NOISE_LABELS[bench.noiseLevel]}」
      </p>

      <div className="space-y-2.5">
        {TIME_PERIODS.map((period) => {
          const sample = getNoiseSample(bench, period);
          const TimeIcon = PERIOD_ICONS[period];
          const isEditing = editingPeriod === period;

          return (
            <div key={period} className="p-3 bg-warm-cream/50 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <TimeIcon className="w-4 h-4 text-ochre flex-shrink-0" />
                  <span className="font-medium text-deep-brown text-sm">
                    {TIME_PERIOD_LABELS[period]}
                  </span>
                </div>

                {!isEditing && (
                  sample ? (
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getNoiseBadgeClass(sample.level)}`}>
                        {NOISE_LABELS[sample.level]}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-ink-light">
                        <CalendarDays className="w-3 h-3" />
                        {sample.sampledAt}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(period)}
                        className="p-1 text-ink-light hover:text-moss-green hover:bg-moss-green/10 rounded transition-colors"
                        aria-label="编辑样本"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNoiseSample(bench.id, sample.id)}
                        className="p-1 text-ink-light hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        aria-label="删除样本"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-light/60">
                        沿用整体：{NOISE_LABELS[bench.noiseLevel]}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(period)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-moss-green hover:bg-moss-green/10 rounded-md transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加样本
                      </button>
                    </div>
                  )
                )}
              </div>

              {isEditing && (
                <div className="mt-3 pt-3 border-t border-deep-brown/10 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-light">噪音</span>
                    {(Object.entries(NOISE_LABELS) as [NoiseLevelType, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLevel(value)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          level === value
                            ? `${getNoiseBadgeClass(value)} border-deep-brown/20 font-medium`
                            : 'bg-white/60 text-ink-light border-deep-brown/10 hover:bg-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-light">采样日期</span>
                    <input
                      type="date"
                      value={sampledAt}
                      min={minDate}
                      onChange={(e) => {
                        setSampledAt(e.target.value);
                        setError('');
                      }}
                      className="px-2 py-1 text-xs bg-white border border-deep-brown/10 rounded-md text-deep-brown focus:outline-none focus:ring-1 focus:ring-moss-green"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <Info className="w-3 h-3 flex-shrink-0" />
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPeriod(null);
                        setError('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-light hover:bg-deep-brown/5 rounded-md transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-moss-green hover:bg-moss-light rounded-md transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      保存
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

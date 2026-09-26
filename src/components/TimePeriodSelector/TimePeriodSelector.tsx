import { Sunrise, Sun, CloudSun, Sunset, Moon } from 'lucide-react';
import { useBenchStore } from '@/store/useBenchStore';
import { TIME_PERIODS, TIME_PERIOD_LABELS } from '@/types';
import type { TimePeriodType } from '@/types';

const PERIOD_ICONS: Record<TimePeriodType, typeof Sunrise> = {
  morning: Sunrise,
  noon: Sun,
  afternoon: CloudSun,
  evening: Sunset,
  night: Moon,
};

interface TimePeriodSelectorProps {
  className?: string;
}

export default function TimePeriodSelector({ className = '' }: TimePeriodSelectorProps) {
  const selectedPeriod = useBenchStore((s) => s.selectedPeriod);
  const setSelectedPeriod = useBenchStore((s) => s.setSelectedPeriod);

  const options: { value: TimePeriodType | null; label: string; Icon?: typeof Sunrise }[] = [
    { value: null, label: '综合' },
    ...TIME_PERIODS.map((value) => ({ value, label: TIME_PERIOD_LABELS[value], Icon: PERIOD_ICONS[value] })),
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map(({ value, label, Icon }) => {
        const active = selectedPeriod === value;
        return (
          <button
            key={value ?? 'all'}
            type="button"
            onClick={() => setSelectedPeriod(value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
              active
                ? 'bg-moss-green text-white border-moss-green shadow-sm'
                : 'bg-white/50 text-ink-light border-deep-brown/10 hover:bg-white'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

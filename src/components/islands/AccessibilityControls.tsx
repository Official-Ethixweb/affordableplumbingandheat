import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Minus, Plus, RotateCcw } from 'lucide-react';

export function A11ySection({
  title,
  children,
  columns = 1
}: {
  title: string;
  children: React.ReactNode;
  columns?: 1 | 3;
}) {
  return (
    <section className="border-ink-100 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-ink-400 text-xs font-semibold tracking-[0.14em] uppercase">{title}</h3>
      <div className={`mt-3 grid gap-2 ${columns === 3 ? 'grid-cols-3' : ''}`}>{children}</div>
    </section>
  );
}

export function A11yToggleBox({
  icon: Icon,
  label,
  tooltip,
  checked,
  onChange
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={tooltip}
      onClick={() => onChange(!checked)}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-3 text-center transition-colors duration-200 ${
        checked ? 'border-orange-500 bg-orange-50' : 'border-ink-100 hover:border-ink-200 bg-white'
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-200 ${
          checked ? 'bg-orange-600 text-white' : 'bg-ink-50 text-ink-500'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-ink-800 line-clamp-2 text-[11px] leading-tight font-medium">{label}</span>
    </button>
  );
}

export function A11yStepper({
  icon: Icon,
  label,
  tooltip,
  valueLabel,
  onIncrease,
  onDecrease,
  onReset,
  canIncrease = true,
  canDecrease = true
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  valueLabel: string;
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
  canIncrease?: boolean;
  canDecrease?: boolean;
}) {
  return (
    <div className="border-ink-100 rounded-xl border bg-white px-3 py-2.5" title={tooltip}>
      <div className="flex items-center gap-3">
        <span className="bg-ink-50 text-ink-500 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-ink-800 min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        <span className="text-ink-500 shrink-0 text-xs tabular-nums">{valueLabel}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={!canDecrease}
          onClick={onDecrease}
          className="border-ink-100 text-ink-800 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:border-orange-400 hover:text-orange-600 disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Reset ${label.toLowerCase()}`}
          onClick={onReset}
          className="border-ink-100 text-ink-500 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:border-orange-400 hover:text-orange-600"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={!canIncrease}
          onClick={onIncrease}
          className="border-ink-100 text-ink-800 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:border-orange-400 hover:text-orange-600 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function A11ySlider({
  icon: Icon,
  label,
  tooltip,
  min,
  max,
  step,
  value,
  displayValue,
  onChange
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="border-ink-100 rounded-xl border bg-white px-3 py-2.5" title={tooltip}>
      <div className="flex items-center gap-3">
        <span className="bg-ink-50 text-ink-500 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon className="h-4 w-4" />
        </span>
        <label className="text-ink-800 min-w-0 flex-1 truncate text-sm font-medium">{label}</label>
        <span className="text-ink-500 shrink-0 text-xs tabular-nums">{displayValue}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="a11y-slider mt-0.5"
      />
    </div>
  );
}

export function A11yButtonGroup<T extends string>({
  icon: Icon,
  label,
  tooltip,
  options,
  value,
  onChange
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  options: { value: T; label: string; icon: LucideIcon }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="border-ink-100 rounded-xl border bg-white px-3 py-2.5" title={tooltip}>
      <div className="flex items-center gap-3">
        <span className="bg-ink-50 text-ink-500 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-ink-800 min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(opt.value)}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border py-1.5 transition-colors ${
              value === opt.value
                ? 'border-orange-500 bg-orange-50 text-orange-600'
                : 'border-ink-100 text-ink-500 hover:border-ink-200'
            }`}
          >
            <opt.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function A11ySelect({
  icon: Icon,
  label,
  tooltip,
  value,
  options,
  onChange,
  disabled
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="border-ink-100 rounded-xl border bg-white px-3 py-2.5" title={tooltip}>
      <div className="flex items-center gap-3">
        <span className="bg-ink-50 text-ink-500 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon className="h-4 w-4" />
        </span>
        <label className="text-ink-800 min-w-0 flex-1 truncate text-sm font-medium">{label}</label>
      </div>
      <div className="relative mt-2.5">
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="border-ink-100 bg-ink-50 text-ink-800 min-h-11 w-full appearance-none rounded-lg border py-1.5 pr-8 pl-2.5 text-xs font-medium disabled:opacity-50"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="text-ink-400 pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2" />
      </div>
    </div>
  );
}

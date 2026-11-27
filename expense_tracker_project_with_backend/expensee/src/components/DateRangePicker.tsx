import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  RANGE_PRESETS,
  type DayRange,
  dayKeyToLocalDate,
  formatDayKey,
  formatDayRange,
  localDateToDayKey,
  matchPreset,
  todayKey,
} from '@/lib/dateRange';

interface DateRangePickerProps {
  id?: string;
  value: DayRange | null;
  onChange: (range: DayRange | null) => void;
  /** When set, the first option clears the range (for example "All dates"). */
  clearLabel?: string;
  presets?: string[];
  className?: string;
  align?: 'start' | 'center' | 'end';
}

const DEFAULT_PRESETS = ['today', 'last7', 'last30', 'thisMonth', 'lastMonth', 'thisQuarter', 'thisYear', 'lastYear'];

export default function DateRangePicker({
  id, value, onChange, clearLabel, presets = DEFAULT_PRESETS, className, align = 'start',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: string; end: string | null } | null>(null);
  const [month, setMonth] = useState<Date>(() => dayKeyToLocalDate(value?.start ?? todayKey()));

  const options = RANGE_PRESETS.filter(p => presets.includes(p.id));
  const active = matchPreset(value);
  const label = value ? (active ? active.label : formatDayRange(value)) : (clearLabel ?? 'Select dates');
  const detail = value && active ? formatDayRange(value) : null;

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDraft(value ? { ...value } : null);
      const anchor = value ? dayKeyToLocalDate(value.end) : dayKeyToLocalDate(todayKey());
      // Show the end month on the right of the two-month view.
      setMonth(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
    }
  };

  const apply = (range: DayRange | null) => {
    onChange(range);
    setOpen(false);
  };

  // First click starts a new range, the second click closes it (in either order).
  const pickDay = (day: Date) => {
    const key = localDateToDayKey(day);
    if (!draft || draft.end !== null) setDraft({ start: key, end: null });
    else if (key < draft.start) setDraft({ start: key, end: draft.start });
    else setDraft({ start: draft.start, end: key });
  };

  const selected = draft
    ? { from: dayKeyToLocalDate(draft.start), to: dayKeyToLocalDate(draft.end ?? draft.start) }
    : undefined;

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" className={cn('h-10 justify-start gap-2 px-3 font-normal', className)}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="truncate">{label}</span>
          {detail && <span className="hidden truncate text-muted-foreground lg:inline">{detail}</span>}
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-40 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
            {clearLabel && (
              <PresetButton label={clearLabel} selected={!value} onClick={() => apply(null)} />
            )}
            {options.map(preset => (
              <PresetButton
                key={preset.id}
                label={preset.label}
                selected={active?.id === preset.id}
                onClick={() => apply(preset.range())}
              />
            ))}
          </div>
          <div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={(_range, day) => pickDay(day)}
            />
            <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {draft
                  ? draft.end === null
                    ? `From ${formatDayKey(draft.start)}`
                    : formatDayRange({ start: draft.start, end: draft.end })
                  : 'Select a start date'}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={!draft}
                  onClick={() => draft && apply({ start: draft.start, end: draft.end ?? draft.start })}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
        selected && 'font-medium',
      )}
    >
      {label}
      {selected && <Check className="h-4 w-4" aria-hidden />}
    </button>
  );
}

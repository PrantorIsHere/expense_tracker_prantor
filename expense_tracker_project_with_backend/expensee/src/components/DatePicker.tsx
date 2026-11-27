import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { dayKeyToLocalDate, formatDayKey, localDateToDayKey, todayKey } from '@/lib/dateRange';

interface DatePickerProps {
  id?: string;
  /** `YYYY-MM-DD` (Asia/Dhaka calendar day) or '' for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show a control that clears the date (for optional dates). */
  clearable?: boolean;
  className?: string;
}

/** A calendar date field. Avoids the native date input, whose year segment accepts 5–6 digits. */
export default function DatePicker({ id, value, onChange, placeholder = 'Pick a date', clearable, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? dayKeyToLocalDate(value) : undefined;

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className={cn('h-10 w-full justify-start gap-2 px-3 font-normal', !value && 'text-muted-foreground', clearable && value && 'pr-9')}>
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
            {value ? formatDayKey(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? dayKeyToLocalDate(todayKey())}
            onSelect={(day) => {
              if (day) onChange(localDateToDayKey(day));
              setOpen(false);
            }}
          />
          <div className="flex justify-between border-t px-3 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(todayKey()); setOpen(false); }}>Today</Button>
            {clearable && value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(''); setOpen(false); }}>Clear</Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear date"
          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Class names follow the react-day-picker v9 UI keys.
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-3',
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-0 top-0 flex h-8 items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost' }), 'h-8 w-8 p-0'),
        button_next: cn(buttonVariants({ variant: 'ghost' }), 'h-8 w-8 p-0'),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-xs font-normal text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative h-9 w-9 p-0 text-center text-sm',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'h-9 w-9 p-0 font-normal'),
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground',
        range_start: 'rounded-l-md bg-accent',
        range_end: 'rounded-r-md bg-accent',
        range_middle: 'bg-accent [&>button]:!bg-transparent [&>button]:!text-accent-foreground',
        today: '[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };

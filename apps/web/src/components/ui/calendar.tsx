'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout="around"
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'relative space-y-3',
        month_caption: 'flex justify-center pt-1 relative items-center h-8',
        caption_label: 'text-sm font-medium text-foreground',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between pointer-events-none',
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute left-0 top-0 z-10 h-8 w-8 bg-transparent p-0 opacity-70 pointer-events-auto hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute right-0 top-0 z-10 h-8 w-8 bg-transparent p-0 opacity-70 pointer-events-auto hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-primary rounded-md w-9 font-medium text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 rounded-md p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          'bg-background text-foreground border border-border shadow-sm hover:bg-background hover:text-foreground focus:bg-background focus:text-foreground rounded-md',
        today: 'bg-muted/60 text-foreground rounded-md',
        outside: 'text-muted-foreground/50',
        disabled: 'text-muted-foreground opacity-50',
        range_middle: 'aria-selected:bg-primary/15 aria-selected:text-foreground rounded-none',
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <IconChevronLeft className="h-4 w-4" />
          ) : (
            <IconChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };

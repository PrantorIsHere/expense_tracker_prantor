import { getDhakaDateInputValue } from './dhakaTime';

/**
 * Calendar-day ranges as `YYYY-MM-DD` strings in Asia/Dhaka.
 * Working with day keys (not Date instants) keeps a picked day the same day
 * no matter which time zone the browser runs in.
 */
export interface DayRange {
  start: string;
  end: string;
}

const KEY = /^\d{4}-\d{2}-\d{2}$/;

const toUTC = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (date: Date) => date.toISOString().slice(0, 10);

export const isDayKey = (value: string) => KEY.test(value) && fromUTC(toUTC(value)) === value;

export const todayKey = () => getDhakaDateInputValue();

/** Dhaka calendar day of a stored timestamp ("2026-11-20T18:30:00Z" is 21 Nov in Dhaka). */
export const dayKeyOf = (value: string): string => {
  if (KEY.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? getDhakaDateInputValue(date) : '';
};

export const addDays = (key: string, days: number) => {
  const date = toUTC(key);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
};

export const addMonths = (key: string, months: number) => {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return fromUTC(target);
};

export const startOfMonth = (key: string) => `${key.slice(0, 7)}-01`;
export const endOfMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return fromUTC(new Date(Date.UTC(y, m, 0)));
};
const startOfQuarter = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
};

/** Inclusive number of days in a range. */
export const dayCount = (range: DayRange) => Math.round((toUTC(range.end).getTime() - toUTC(range.start).getTime()) / 86400000) + 1;

export const inRange = (key: string, range: DayRange | null) => !range || (key >= range.start && key <= range.end);

export interface RangePreset {
  id: string;
  label: string;
  range: () => DayRange;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: 'today', label: 'Today', range: () => ({ start: todayKey(), end: todayKey() }) },
  { id: 'last7', label: 'Last 7 days', range: () => ({ start: addDays(todayKey(), -6), end: todayKey() }) },
  { id: 'last30', label: 'Last 30 days', range: () => ({ start: addDays(todayKey(), -29), end: todayKey() }) },
  { id: 'thisMonth', label: 'This month', range: () => ({ start: startOfMonth(todayKey()), end: todayKey() }) },
  {
    id: 'lastMonth', label: 'Last month', range: () => {
      const start = startOfMonth(addMonths(startOfMonth(todayKey()), -1));
      return { start, end: endOfMonth(start) };
    },
  },
  { id: 'thisQuarter', label: 'This quarter', range: () => ({ start: startOfQuarter(todayKey()), end: todayKey() }) },
  { id: 'thisYear', label: 'This year', range: () => ({ start: `${todayKey().slice(0, 4)}-01-01`, end: todayKey() }) },
  {
    id: 'lastYear', label: 'Last year', range: () => {
      const year = Number(todayKey().slice(0, 4)) - 1;
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    },
  },
  {
    id: 'last12', label: 'Last 12 months', range: () => ({ start: startOfMonth(addMonths(todayKey(), -11)), end: todayKey() }),
  },
];

export const matchPreset = (range: DayRange | null) =>
  range ? RANGE_PRESETS.find(p => {
    const r = p.range();
    return r.start === range.start && r.end === range.end;
  }) : undefined;

/**
 * The period a range is compared against, the way accounting reports do it:
 * - whole months: the same number of whole months before (last year → the year before)
 * - year to date: the same dates last year
 * - quarter to date: the same days of the previous quarter
 * - month(s) to date: the same days, shifted back by the months covered
 * - anything else: the same number of days right before the range
 */
export const previousPeriod = (range: DayRange): DayRange => {
  if (range.start.endsWith('-01')) {
    const span = (Number(range.end.slice(0, 4)) - Number(range.start.slice(0, 4))) * 12
      + Number(range.end.slice(5, 7)) - Number(range.start.slice(5, 7)) + 1;
    const wholeMonths = range.end === endOfMonth(range.end);
    let shift = span;
    if (!wholeMonths && range.start.slice(5) === '01-01') shift = 12;
    else if (!wholeMonths && range.start === startOfQuarter(range.start) && span <= 3) shift = 3;
    const end = addMonths(range.end, -shift);
    return { start: addMonths(range.start, -shift), end: wholeMonths ? endOfMonth(end) : end };
  }
  const length = dayCount(range);
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
};

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
export const formatDayKey = (key: string) => dayFormat.format(toUTC(key));
export const formatDayRange = (range: DayRange) =>
  range.start === range.end ? formatDayKey(range.start) : `${formatDayKey(range.start)} – ${formatDayKey(range.end)}`;

/** Local-midnight Date for the calendar widget, and back. */
export const dayKeyToLocalDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const localDateToDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

import { getDhakaDateInputValue } from './dhakaTime';

export interface StatementPeriod {
  start: string;
  end: string;
  from: Date;
  to: Date;
  startTime: number;
  endExclusive: number;
  label: string;
  filename: string;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+06:00`);
  if (!Number.isFinite(date.getTime())) return null;
  return getDhakaDateInputValue(date) === value ? date : null;
}

export function createStatementPeriod(start: string, end: string): StatementPeriod {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) throw new Error('Please select valid From and To dates.');
  if (start > end) throw new Error('From date must be on or before To date.');
  const display = (date: string) => date.split('-').reverse().join('/');
  return {
    start, end, from, to,
    startTime: from.getTime(),
    endExclusive: to.getTime() + 86400000,
    label: `${display(start)} - ${display(end)}`,
    filename: `statement-${start}-to-${end}.pdf`
  };
}

export function createMonthlyPeriod(year: number, month: number): StatementPeriod {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const period = createStatementPeriod(`${prefix}-01`, `${prefix}-${lastDay}`);
  const monthName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', month: 'long' }).format(period.from);
  return { ...period, label: `${monthName} ${year}`, filename: `statement-${monthName}-${year}.pdf` };
}

export function selectStatementTransactions<T extends { date: string }>(transactions: T[], period: StatementPeriod): T[] {
  return transactions.filter(transaction => {
    if (!transaction.date) return false;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
      ? parseDate(transaction.date)
      : new Date(transaction.date);
    const time = date?.getTime() ?? NaN;
    return time >= period.startTime && time < period.endExclusive;
  });
}

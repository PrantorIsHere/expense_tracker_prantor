import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { bankLogoFor } from '@/lib/bankLogos';

/* ---------- page layout ---------- */

/** The bar under the app bar: title on the left with the main action, tools on the right. */
export function ControlPanel({ title, crumb, actions, children, className }: {
  title: string;
  /** Optional parent section, shown before the title (for example a Settings tab). */
  crumb?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('sticky top-0 z-20 border-b bg-card px-4 py-2.5 md:px-6', className)}>
      <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-lg font-semibold">
            {crumb && <span className="font-normal text-muted-foreground">{crumb} / </span>}
            {title}
          </h1>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-4 p-4 md:p-6', className)}>{children}</div>;
}

/** A white sheet with a title band, the building block of every screen. */
export function Sheet({ title, note, actions, children, className, bodyClassName }: {
  title?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('flex flex-col overflow-hidden rounded-lg border bg-card', className)}>
      {(title || actions) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
          <h2 className="text-sm font-semibold">
            {title}
            {note && <span className="ml-2 font-normal text-muted-foreground">{note}</span>}
          </h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ---------- people and records ---------- */

const AVATAR_COLORS = ['#c2410c', '#1d4ed8', '#15803d', '#9d174d', '#b45309', '#0e7490', '#6d28d9', '#be123c', '#4d7c0f', '#0369a1'];

export function colorForName(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Dark text on light record colors, white on dark ones. */
function inkFor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#fff';
}

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';

/** Initials on a color picked from the name (or a record's own color), like ERP record avatars. */
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';
const AVATAR_DIMS: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar({ name, color, size = 'md', square }: { name: string; color?: string; size?: AvatarSize; square?: boolean }) {
  const dims = AVATAR_DIMS[size];
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center font-semibold', square ? 'rounded-md' : 'rounded-full', dims)}
      style={{ backgroundColor: color || colorForName(name), color: inkFor(color || colorForName(name)) }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

/** Default color the server gives new accounts; treated as "no color chosen". */
const DEFAULT_ACCOUNT_COLOR = '#4ECDC4';

/** An account's bank or wallet logo on a white tile, or colored initials when there is no logo. */
export function AccountAvatar({ name, bankName, color, size = 'md' }: { name: string; bankName?: string | null; color?: string | null; size?: AvatarSize }) {
  const logo = bankLogoFor(name, bankName);
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/10', AVATAR_DIMS[size])}>
        <img src={logo.src} alt="" className="h-full w-full object-contain p-0.5" onError={() => setFailed(true)} />
      </span>
    );
  }
  const chosen = color && color.toUpperCase() !== DEFAULT_ACCOUNT_COLOR ? color : undefined;
  return <Avatar name={name} color={chosen} size={size} square />;
}

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'teal' | 'violet' | 'orange' | 'gray';

const TONES: Record<Tone, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  gray: 'bg-muted text-muted-foreground',
};

/** Soft pill for a record's type or state. */
export function Tag({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}

export const TX_TONE: Record<string, Tone> = {
  income: 'green',
  expense: 'red',
  transfer: 'violet',
  loan_given: 'amber',
  loan_taken: 'blue',
  loan_received: 'teal',
  loan_repaid: 'orange',
};

export const TX_LABEL: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
  loan_given: 'Loan given',
  loan_taken: 'Loan taken',
  loan_received: 'Loan repaid to you',
  loan_repaid: 'Loan repaid by you',
};

/** Workflow steps with the current one highlighted (the ERP status bar). */
export function StatusBar({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn('flex overflow-hidden rounded-md border text-xs', className)} aria-label="Status">
      {steps.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? 'step' : undefined}
          className={cn(
            'relative flex-1 whitespace-nowrap px-3 py-1 text-center',
            i > 0 && 'border-l',
            i === current ? 'bg-primary font-medium text-primary-foreground' : i < current ? 'bg-muted text-foreground' : 'text-muted-foreground',
          )}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}

export function Pager({ from, to, total, onPrev, onNext }: { from: number; to: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="px-1 tabular-nums text-muted-foreground">{total === 0 ? '0' : `${from}–${to}`} / {total}</span>
      <button type="button" onClick={onPrev} disabled={from <= 1} aria-label="Previous page"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card hover:bg-muted disabled:opacity-40">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={onNext} disabled={to >= total} aria-label="Next page"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card hover:bg-muted disabled:opacity-40">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Column spans for a group header row, per breakpoint. Hidden table cells do not take
 * a column, so one fixed colSpan would push the subtotal off small screens.
 */
export type GroupSpans = { xs: [number, number]; sm: [number, number]; md: [number, number]; lg: [number, number] };
const GROUP_ROW_VISIBILITY = { xs: 'sm:hidden', sm: 'hidden sm:table-row md:hidden', md: 'hidden md:table-row lg:hidden', lg: 'hidden lg:table-row' } as const;

/** Renders the group header once per breakpoint: label cell, subtotal cell, trailing cell. */
export function GroupHeaderRows({ spans, label, subtotal, rowClassName, labelClassName, subtotalClassName }: {
  spans: GroupSpans;
  label: ReactNode;
  subtotal: ReactNode;
  rowClassName?: string;
  labelClassName?: string;
  subtotalClassName?: string;
}) {
  return (
    <>
      {(Object.keys(GROUP_ROW_VISIBILITY) as (keyof GroupSpans)[]).map(bp => (
        <tr key={bp} className={cn('border-b', GROUP_ROW_VISIBILITY[bp], rowClassName)}>
          <td colSpan={spans[bp][0]} className={cn('px-3 py-2 align-middle', labelClassName)}>{label}</td>
          <td className={cn('px-3 py-2 text-right align-middle', subtotalClassName)}>{subtotal}</td>
          <td colSpan={spans[bp][1]} />
        </tr>
      ))}
    </>
  );
}

/* ---------- figures ---------- */

/** Signed change shown under a figure; color follows whether the direction is good. */
export function Delta({ value, label, upIsGood = true, format }: { value: number | null; label?: string; upIsGood?: boolean; format: (n: number) => string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : (value > 0) === upIsGood;
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <p className={cn('flex items-center gap-1 text-xs', good === null ? 'text-muted-foreground' : good ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
      {!flat && <Icon className="h-3 w-3" aria-hidden />}
      {flat ? 'No change' : format(value)}
      {label && <span className="text-muted-foreground">{label}</span>}
    </p>
  );
}

/** Label, figure, optional change and a 12-point trend line. */
export function Scorecard({ label, value, delta, trend, color, emphasis, className }: {
  label: string;
  value: string;
  delta?: ReactNode;
  trend?: number[];
  color?: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col justify-between gap-2 rounded-lg border bg-card p-4', className)}>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('mt-1 font-semibold', emphasis ? 'text-3xl' : 'text-2xl')}>{value}</p>
        <div className="mt-1 min-h-4">{delta}</div>
      </div>
      {trend && trend.length > 1 && (
        <div className="h-10" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

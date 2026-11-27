import { useState, type ComponentType } from 'react';
import {
  BarChart3,
  Banknote,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Receipt,
  Settings,
  Target,
  Users,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import UserHeader from '@/components/UserHeader';
import { cn } from '@/lib/utils';

interface Module {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  badge?: number;
}

interface AppNavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingLoansCount: number;
  activeGoalsCount: number;
}

export default function AppNavbar({ activeTab, onTabChange, pendingLoansCount, activeGoalsCount }: AppNavbarProps) {
  const [launcherOpen, setLauncherOpen] = useState(false);

  const modules: Module[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: '#0f766e' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, color: '#1d4ed8' },
    { id: 'reports', label: 'Reports', icon: BarChart3, color: '#6d28d9' },
    { id: 'loans', label: 'Loans', icon: Banknote, color: '#b45309', badge: pendingLoansCount },
    { id: 'goals', label: 'Goals', icon: Target, color: '#15803d', badge: activeGoalsCount },
    { id: 'users', label: 'Users', icon: Users, color: '#be123c' },
    { id: 'settings', label: 'Settings', icon: Settings, color: '#475569' },
    { id: 'additional', label: 'Additional info', icon: Info, color: '#0e7490' },
  ];
  const current = modules.find(m => m.id === activeTab) ?? modules[0];

  const go = (id: string) => {
    onTabChange(id);
    setLauncherOpen(false);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 bg-navbar px-2 text-navbar-foreground shadow-sm md:px-3">
      <Popover open={launcherOpen} onOpenChange={setLauncherOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="All apps"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-navbar-muted hover:bg-navbar-hover hover:text-navbar-foreground"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[22rem] p-3">
          <div className="grid grid-cols-4 gap-1">
            {modules.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => go(m.id)}
                  aria-current={m.id === activeTab ? 'page' : undefined}
                  className={cn('relative flex flex-col items-center gap-1.5 rounded-md p-2 text-center text-xs hover:bg-muted', m.id === activeTab && 'bg-muted font-medium')}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: m.color }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="leading-tight">{m.label}</span>
                  {!!m.badge && (
                    <span className="absolute right-2 top-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{m.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <span className="mr-2 hidden whitespace-nowrap px-1 text-[15px] font-semibold md:inline">Expense Tracker</span>
      <span className="whitespace-nowrap px-1 text-[15px] font-semibold md:hidden">{current.label}</span>

      <nav className="hidden min-w-0 items-center gap-0.5 lg:flex" aria-label="Main">
        {modules.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => go(m.id)}
            aria-current={m.id === activeTab ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm transition-colors',
              m.id === activeTab
                ? 'bg-navbar-hover font-medium text-navbar-foreground'
                : 'text-navbar-muted hover:bg-navbar-hover hover:text-navbar-foreground',
            )}
          >
            {m.label}
            {!!m.badge && <span className="rounded-full bg-white/15 px-1.5 text-[11px] leading-4 tabular-nums">{m.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="ml-auto">
        <UserHeader />
      </div>
    </header>
  );
}

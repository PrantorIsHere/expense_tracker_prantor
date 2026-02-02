import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Home,
  Receipt,
  TrendingUp,
  Users,
  Settings,
  Menu,
  X,
  Banknote,
  Info,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
    { id: 'loans', label: 'Loans', icon: Banknote },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'additional', label: 'Additional Info', icon: Info },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-50 hover:bg-primary/10"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-card to-background dark:from-card dark:to-background border-r border-border shadow-xl transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-0
      `}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-6 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              Expense Tracker
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Manage your finances</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? 'default' : 'ghost'}
                  className={`
                    w-full justify-start transition-all duration-200 hover-lift
                    ${isActive ? 'shadow-md bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}
                  `}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                  onClick={() => {
                    onTabChange(item.id);
                    setIsOpen(false);
                  }}
                >
                  <Icon className={`mr-3 h-5 w-5 ${isActive ? 'animate-pulse' : ''}`} />
                  <span className="font-medium">{item.label}</span>
                </Button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="text-xs text-muted-foreground text-center">
              <p className="font-medium">Version 2.0</p>
              <p className="mt-1">© 2024 Expense Tracker</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
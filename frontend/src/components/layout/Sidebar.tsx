import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  Megaphone,
  Sparkles,
  LogOut,
  Flower2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/segments', label: 'Segments', icon: Layers },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/ai', label: 'AI Assistant', icon: Sparkles },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-white dark:bg-[#131720] border-r border-slate-200 dark:border-white/[0.06] z-10 transition-colors">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200 dark:border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-crm-blue-dim text-blue-500">
          <Flower2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
            Aura Beauty
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">CRM Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'border-l-2 border-l-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-500'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-300'
              )
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 space-y-3 border-t border-slate-200 dark:border-white/[0.06]">
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-600 px-2 mb-2">Appearance</p>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {user?.full_name ?? user?.email ?? 'User'}
            </p>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-white/5 px-2"
            onClick={handleLogout}
            id="sidebar-logout-btn"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

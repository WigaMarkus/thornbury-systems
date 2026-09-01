import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CalendarClock,
  Droplets,
  LayoutDashboard,
  Receipt,
  Users,
} from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users, end: false },
  { to: '/invoices', label: 'Invoices', icon: Receipt, end: false },
  { to: '/scheduling', label: 'Scheduling', icon: CalendarClock, end: false },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 w-56 bg-navy-900 text-slate-300">
        <div className="flex items-center gap-2.5 px-5 pb-2 pt-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/20 text-brand-500">
            <Droplets className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-white">
              Thornbury Systems
            </div>
            <div className="text-[11px] text-slate-400">Billing &amp; Scheduling</div>
          </div>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 px-5 py-4 text-[11px] text-slate-500">
          UK water utilities
          <br />
          All times Europe/London
        </div>
      </aside>
      <main className="pl-56">
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

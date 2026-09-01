import type { ReactNode } from 'react';
import { CircleAlert, Inbox, Loader2, RotateCw } from 'lucide-react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-800">Something went wrong</p>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 shadow-sm hover:bg-rose-100"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-slate-300">{icon ?? <Inbox className="h-8 w-8" aria-hidden />}</div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  busy?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
};

export function Button({
  children,
  onClick,
  type = 'button',
  busy = false,
  disabled = false,
  variant = 'primary',
  className = '',
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const look =
    variant === 'primary'
      ? 'bg-navy-800 text-white hover:bg-navy-900'
      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`${base} ${look} ${className}`}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'slate',
  outline = false,
}: {
  children: ReactNode;
  tone?: 'emerald' | 'rose' | 'slate' | 'sky' | 'amber' | 'violet';
  outline?: boolean;
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    slate: outline
      ? 'bg-white text-slate-600 ring-slate-300'
      : 'bg-slate-100 text-slate-600 ring-slate-500/20',
    sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  tone = 'slate',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'slate' | 'rose' | 'amber';
  hint?: string;
}) {
  const valueColor =
    tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900';
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${valueColor}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

export function Th({
  children,
  align = 'left',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  money = false,
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  money?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-slate-100 px-3 py-2.5 text-sm ${
        align === 'right' || money ? 'text-right tabular-nums' : 'text-left'
      } ${money ? 'font-medium' : ''} ${className}`}
    >
      {children}
    </td>
  );
}

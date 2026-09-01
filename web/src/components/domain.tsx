import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { AccountType, InvoiceSource, WorkOrderStatus } from '../lib/types';
import { Badge } from './ui';

export function PaidBadge({ paid }: { paid: boolean }) {
  return paid ? <Badge tone="emerald">Paid</Badge> : <Badge tone="rose">Unpaid</Badge>;
}

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  if (status === 'DONE') return <Badge tone="emerald">Done</Badge>;
  if (status === 'DISPATCHED') return <Badge tone="sky">Dispatched</Badge>;
  return <Badge tone="slate">Queued</Badge>;
}

export function SourceBadge({ source }: { source: InvoiceSource }) {
  if (source === 'LEGACY_PAPER') return <Badge tone="violet">Legacy paper</Badge>;
  return (
    <Badge tone="slate" outline>
      {source === 'WEB' ? 'Web' : 'Batch'}
    </Badge>
  );
}

export function AccountTypeBadge({ type }: { type: AccountType }) {
  return (
    <Badge tone="slate" outline>
      {type === 'DOMESTIC' ? 'Domestic' : 'Commercial'}
    </Badge>
  );
}

export function VatBadge({ confirmed }: { confirmed: boolean }) {
  return confirmed ? (
    <Badge tone="emerald">VAT confirmed</Badge>
  ) : (
    <Badge tone="amber">VAT provisional</Badge>
  );
}

export function SkillChip({ skill }: { skill: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-600 ring-1 ring-inset ring-brand-500/20">
      {skill}
    </span>
  );
}

export function AmberBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p className="text-sm text-amber-800">{children}</p>
    </div>
  );
}

export function ProvisionalVatBanner() {
  return (
    <AmberBanner>
      VAT classification is provisional &mdash; awaiting Finance sign-off
    </AmberBanner>
  );
}

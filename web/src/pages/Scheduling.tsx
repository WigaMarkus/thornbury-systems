import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  CheckCircle2,
  HardHat,
  Play,
  Plus,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { api, useFetch } from '../lib/api';
import { ukDateTime, ukTime, ymdToDisplay } from '../lib/format';
import type { Assignment, UnassignedReason } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  Td,
  Th,
} from '../components/ui';
import { SkillChip, StatusBadge } from '../components/domain';

const REASON_TEXT: Record<UnassignedReason, string> = {
  DUPLICATE_VISIT: 'Skipped — another visit is already planned at this address that day',
  NO_ENGINEER_WITH_SKILL: 'No engineer holds the required skill',
};

const REQUIRES_OPTIONS = ['METER', 'LEAK', 'BACKFLOW'];

export default function Scheduling() {
  const { data, loading, error, reload } = useFetch(
    () =>
      Promise.all([
        api.workOrders(),
        api.engineers(),
        api.slots(),
        api.dispatchPreview(),
        api.customers(),
      ]),
    [],
  );

  const [runBusy, setRunBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardNotice, setBoardNotice] = useState<string | null>(null);

  // New work order form state
  const [customerId, setCustomerId] = useState('');
  const [address, setAddress] = useState('');
  const [requires, setRequires] = useState(REQUIRES_OPTIONS[0]);
  const [requestedAt, setRequestedAt] = useState('');
  const [duration, setDuration] = useState('60');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarnings, setFormWarnings] = useState<string[]>([]);

  const slotsByWo = useMemo(() => {
    const map = new Map<string, { window: string; date: string }>();
    if (data) for (const s of data[2]) map.set(s.workOrderId, s);
    return map;
  }, [data]);

  const engineersById = useMemo(() => {
    const map = new Map<string, { name: string; skills: string[] }>();
    if (data) for (const e of data[1]) map.set(e.id, e);
    return map;
  }, [data]);

  if (loading) return <Spinner label="Loading scheduling…" />;
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  const [workOrders, engineers, , dispatch, customers] = data;

  const grouped = new Map<string, Assignment[]>();
  for (const a of dispatch.assignments) {
    const list = grouped.get(a.engineerId) ?? [];
    list.push(a);
    grouped.set(a.engineerId, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0));
  }

  async function runDispatch() {
    setRunBusy(true);
    setBoardError(null);
    setBoardNotice(null);
    try {
      const result = await api.dispatchRun();
      setBoardNotice(
        `Dispatched ${result.dispatchedCount} job${result.dispatchedCount === 1 ? '' : 's'}.`,
      );
      reload();
    } catch (e) {
      setBoardError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunBusy(false);
    }
  }

  async function resetDispatch() {
    setResetBusy(true);
    setBoardError(null);
    setBoardNotice(null);
    try {
      const result = await api.dispatchReset();
      setBoardNotice(`Requeued ${result.requeued} job${result.requeued === 1 ? '' : 's'}.`);
      reload();
    } catch (e) {
      setBoardError(e instanceof Error ? e.message : String(e));
    } finally {
      setResetBusy(false);
    }
  }

  async function submitWorkOrder(e: FormEvent) {
    e.preventDefault();
    setFormBusy(true);
    setFormError(null);
    setFormWarnings([]);
    try {
      const parsed = new Date(requestedAt);
      const result = await api.createWorkOrder({
        customerId,
        address,
        requires,
        requestedAt: Number.isNaN(parsed.getTime()) ? requestedAt : parsed.toISOString(),
        durationMinutes: Number(duration),
      });
      setFormWarnings(result.warnings);
      setCustomerId('');
      setAddress('');
      setRequestedAt('');
      setDuration('60');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Scheduling"
        subtitle="Work orders, dispatch board and field engineers"
      />

      {/* Zone 1: work orders */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Work orders</h2>
        {workOrders.length === 0 ? (
          <EmptyState title="No work orders" hint="Raised jobs will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Address</Th>
                  <Th>Requires</Th>
                  <Th>Requested</Th>
                  <Th align="right">Duration</Th>
                  <Th>Status</Th>
                  <Th>Appointment</Th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => {
                  const slot = slotsByWo.get(wo.id);
                  return (
                    <tr key={wo.id} className="hover:bg-slate-50">
                      <Td className="font-medium text-slate-900">{wo.id}</Td>
                      <Td>{wo.customerName}</Td>
                      <Td className="text-slate-600">{wo.address}</Td>
                      <Td>
                        <Badge tone="slate" outline>
                          {wo.requires}
                        </Badge>
                      </Td>
                      <Td className="tabular-nums text-slate-600">
                        {ukDateTime(wo.requestedAt)}
                      </Td>
                      <Td align="right" className="tabular-nums text-slate-600">
                        {wo.durationMinutes} min
                      </Td>
                      <Td>
                        <StatusBadge status={wo.status} />
                      </Td>
                      <Td className="tabular-nums text-slate-600">
                        {slot ? `${ymdToDisplay(slot.date)} · ${slot.window}` : '—'}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Zone 2: dispatch board */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Dispatch board</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {dispatch.assignments.length} assignable &middot; {dispatch.unassigned.length}{' '}
              needing attention
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={resetDispatch} busy={resetBusy}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </Button>
            <Button onClick={runDispatch} busy={runBusy}>
              <Play className="h-4 w-4" aria-hidden />
              Run dispatch
            </Button>
          </div>
        </div>
        {boardError && (
          <p className="mb-3 text-sm font-medium text-rose-600">{boardError}</p>
        )}
        {boardNotice && (
          <p className="mb-3 text-sm font-medium text-emerald-700">{boardNotice}</p>
        )}

        {grouped.size === 0 ? (
          <EmptyState
            title="Nothing to assign right now"
            hint="Queued work orders appear here once the preview finds an engineer."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...grouped.entries()].map(([engineerId, jobs]) => {
              const eng = engineersById.get(engineerId);
              return (
                <div
                  key={engineerId}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex items-center gap-2">
                    <HardHat className="h-4 w-4 text-slate-400" aria-hidden />
                    <span className="text-sm font-semibold text-slate-900">
                      {jobs[0].engineerName}
                    </span>
                  </div>
                  {eng && eng.skills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {eng.skills.map((s) => (
                        <SkillChip key={s} skill={s} />
                      ))}
                    </div>
                  )}
                  <ul className="mt-3 space-y-2">
                    {jobs.map((job) => (
                      <li
                        key={job.workOrderId}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium tabular-nums text-slate-900">
                            {ukTime(job.startsAt)}&ndash;{ukTime(job.endsAt)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            {job.workOrderId}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{job.customerName}</p>
                        <p className="text-xs text-slate-500">{job.address}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5">
          {dispatch.unassigned.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <p className="text-sm font-medium text-emerald-800">
                Every queued job has an engineer
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Needs attention ({dispatch.unassigned.length})
              </h3>
              {dispatch.unassigned.map((u) => (
                <div
                  key={u.workOrderId}
                  className="flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3"
                >
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{u.workOrderId}</p>
                    <p className="text-sm text-amber-800">{REASON_TEXT[u.reason]}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Zone 3: new work order + engineers */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">New work order</h2>
          <form onSubmit={submitWorkOrder} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Customer</span>
                <select
                  required
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    const c = customers.find((x) => x.id === e.target.value);
                    if (c) setAddress(c.address);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="" disabled>
                    Select a customer…
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Requires</span>
                <select
                  value={requires}
                  onChange={(e) => setRequires(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {REQUIRES_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Address</span>
              <input
                required
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Site address"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Requested at</span>
                <input
                  required
                  type="datetime-local"
                  value={requestedAt}
                  onChange={(e) => setRequestedAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Duration (minutes)
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </label>
            </div>
            {formError && <p className="text-sm font-medium text-rose-600">{formError}</p>}
            {formWarnings.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <p className="text-sm text-amber-800">
                  Created with warning: {formWarnings.join(', ')}
                </p>
              </div>
            )}
            <Button type="submit" busy={formBusy}>
              <Plus className="h-4 w-4" aria-hidden />
              Create work order
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Engineers</h2>
          {engineers.length === 0 ? (
            <EmptyState title="No engineers" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {engineers.map((eng) => (
                <li key={eng.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{eng.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {eng.skills.map((s) => (
                        <SkillChip key={s} skill={s} />
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    <span className="font-semibold tabular-nums text-slate-900">
                      {eng.activeOrders}
                    </span>{' '}
                    active
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

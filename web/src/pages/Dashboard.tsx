import { Link } from 'react-router-dom';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { api, useFetch } from '../lib/api';
import { formatPence, ymdToDisplay } from '../lib/format';
import { Card, ErrorState, EmptyState, KpiCard, PageHeader, Spinner, Td, Th } from '../components/ui';
import { PaidBadge, SourceBadge } from '../components/domain';

export default function Dashboard() {
  const { data, loading, error, reload } = useFetch(
    () => Promise.all([api.customers(), api.invoices(), api.dispatchPreview(), api.workOrders()]),
    [],
  );

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  const [customers, invoices, dispatch, workOrders] = data;

  const totalOutstandingPence = customers.reduce((sum, c) => sum + c.outstandingPence, 0);
  const unpaidCount = invoices.filter((i) => !i.paid).length;
  const openWorkOrders = workOrders.filter((w) => w.status !== 'DONE').length;
  const vatAwaiting = customers.filter((c) => !c.supplyVatConfirmed).length;

  const assignable = dispatch.assignments.length;
  const needingAttention = dispatch.unassigned.length;

  const recent = [...invoices]
    .sort((a, b) => (a.issued < b.issued ? 1 : a.issued > b.issued ? -1 : 0))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Billing and scheduling overview for the Thornbury region"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total outstanding"
          value={formatPence(totalOutstandingPence)}
          tone="rose"
          hint="Across all customer accounts"
        />
        <KpiCard label="Unpaid invoices" value={unpaidCount} hint="Awaiting payment" />
        <KpiCard label="Open work orders" value={openWorkOrders} hint="Queued or dispatched" />
        <KpiCard
          label="VAT awaiting confirmation"
          value={vatAwaiting}
          tone={vatAwaiting > 0 ? 'amber' : 'slate'}
          hint="Customers pending Finance sign-off"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Dispatch summary</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <span>
                {assignable} assignable &middot; {needingAttention} needing attention
              </span>
              {needingAttention > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/25">
                  <TriangleAlert className="h-3 w-3" aria-hidden />
                  {needingAttention} unassigned
                </span>
              )}
            </p>
          </div>
          <Link
            to="/scheduling"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Open scheduling
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent invoices</h2>
        {recent.length === 0 ? (
          <EmptyState title="No invoices yet" hint="New invoices will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Issued</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {inv.id}
                      </Link>
                    </Td>
                    <Td>{inv.customerName}</Td>
                    <Td>{ymdToDisplay(inv.issued)}</Td>
                    <Td>
                      <SourceBadge source={inv.source} />
                    </Td>
                    <Td>
                      <PaidBadge paid={inv.paid} />
                    </Td>
                    <Td money>{inv.display}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

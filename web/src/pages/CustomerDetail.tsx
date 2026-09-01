import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Printer } from 'lucide-react';
import { api, useFetch } from '../lib/api';
import { ymdToDisplay } from '../lib/format';
import type { Statement } from '../lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  Td,
  Th,
} from '../components/ui';
import {
  AccountTypeBadge,
  AmberBanner,
  PaidBadge,
  ProvisionalVatBanner,
  SourceBadge,
  VatBadge,
} from '../components/domain';

function StatementView({ statement }: { statement: Statement }) {
  return (
    <div className="print-visible mt-4 space-y-4">
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">Thornbury Systems &mdash; Statement</h1>
        <p className="text-sm text-slate-600">{statement.customer.name}</p>
      </div>

      {!statement.vatConfirmed && (
        <AmberBanner>
          This statement includes provisional VAT figures &mdash; awaiting Finance sign-off
        </AmberBanner>
      )}

      <p className="text-sm text-slate-600">
        {statement.period.from && statement.period.to
          ? `Period ${ymdToDisplay(statement.period.from)} to ${ymdToDisplay(statement.period.to)}`
          : statement.period.from
            ? `Period from ${ymdToDisplay(statement.period.from)}`
            : statement.period.to
              ? `Period up to ${ymdToDisplay(statement.period.to)}`
              : 'Period: complete history'}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ['Brought forward', statement.display.broughtForward, false],
            ['Net in period', statement.display.netInPeriod, false],
            ['VAT in period', statement.display.vatInPeriod, false],
            ['Invoiced in period', statement.display.invoicedInPeriod, false],
            ['Closing balance', statement.display.closingBalance, true],
          ] as const
        ).map(([label, value, emphasis]) => (
          <div
            key={label}
            className={`rounded-lg border p-3 ${
              emphasis ? 'border-navy-800 bg-navy-900 text-white' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                emphasis ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {statement.lines.length === 0 ? (
        <EmptyState title="No invoices in this period" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Issued</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th align="right">Net</Th>
                <Th align="right">VAT</Th>
                <Th align="right">Total</Th>
                <Th align="right">Outstanding</Th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.map((line) => (
                <tr key={line.invoiceId} className="hover:bg-slate-50">
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <Link
                        to={`/invoices/${line.invoiceId}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {line.invoiceId}
                      </Link>
                      {!line.vatConfirmed && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                          title="VAT provisional"
                        />
                      )}
                    </span>
                  </Td>
                  <Td>{ymdToDisplay(line.issued)}</Td>
                  <Td>
                    <SourceBadge source={line.source} />
                  </Td>
                  <Td>
                    <PaidBadge paid={line.paid} />
                  </Td>
                  <Td money>{line.display.net}</Td>
                  <Td money>{line.display.vat}</Td>
                  <Td money>{line.display.total}</Td>
                  <Td money className={line.outstanding > 0 ? 'text-rose-600' : 'text-slate-500'}>
                    {line.display.outstanding}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetail() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useFetch(
    () => Promise.all([api.customer(id), api.customerInvoices(id)]),
    [id],
  );

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [stmtBusy, setStmtBusy] = useState(false);
  const [stmtError, setStmtError] = useState<string | null>(null);

  if (loading) return <Spinner label="Loading customer…" />;
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  const [customer, invoices] = data;

  async function generateStatement() {
    setStmtBusy(true);
    setStmtError(null);
    try {
      const s = await api.statement(id, from || undefined, to || undefined);
      setStatement(s);
    } catch (e) {
      setStatement(null);
      setStmtError(e instanceof Error ? e.message : String(e));
    } finally {
      setStmtBusy(false);
    }
  }

  return (
    <>
      {/* Only hide the page content from print once a statement exists; otherwise
          printing this page should print the customer details, not a blank page. */}
      <div className={statement ? 'no-print space-y-6' : 'space-y-6'}>
        <PageHeader title={customer.name} subtitle={customer.id} />

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-600">{customer.address}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AccountTypeBadge type={customer.accountType} />
                <VatBadge confirmed={customer.supplyVatConfirmed} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Outstanding
              </p>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${
                  customer.outstandingPence > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {customer.outstanding}
              </p>
            </div>
          </div>
        </Card>

        {!customer.supplyVatConfirmed && <ProvisionalVatBanner />}

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Invoices</h2>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices for this customer" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Issued</Th>
                    <Th>Source</Th>
                    <Th>Status</Th>
                    <Th align="right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <Td>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {inv.id}
                        </Link>
                      </Td>
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
      </div>

      <Card>
        <div className={statement ? 'no-print' : undefined}>
          <h2 className="text-sm font-semibold text-slate-900">Statement</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Leave dates blank for the default period
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <Button onClick={generateStatement} busy={stmtBusy}>
              <FileText className="h-4 w-4" aria-hidden />
              Generate
            </Button>
            {statement && (
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden />
                Print
              </Button>
            )}
          </div>
          {stmtError && <p className="mt-3 text-sm font-medium text-rose-600">{stmtError}</p>}
        </div>

        {statement && <StatementView statement={statement} />}
        {!statement && !stmtError && (
          <div>
            <EmptyState
              title="No statement generated yet"
              hint="Pick a period and press Generate."
              icon={<FileText className="h-8 w-8" aria-hidden />}
            />
          </div>
        )}
      </Card>
    </>
  );
}

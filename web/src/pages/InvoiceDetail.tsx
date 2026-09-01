import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgePoundSterling } from 'lucide-react';
import { api, useFetch } from '../lib/api';
import { formatPence, ukDateTime, ymdToDisplay } from '../lib/format';
import type { VatLiability } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  PageHeader,
  Spinner,
  Td,
  Th,
} from '../components/ui';
import { AmberBanner, PaidBadge, SourceBadge } from '../components/domain';

function bandLabel(liability: VatLiability, ratePercent: number): string {
  const name = liability === 'STANDARD_RATED' ? 'Standard rated' : 'Zero rated';
  return `${name} ${ratePercent}%`;
}

export default function InvoiceDetail() {
  const { id = '' } = useParams();
  const { data: invoice, loading, error, reload } = useFetch(() => api.invoice(id), [id]);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  if (loading) return <Spinner label="Loading invoice…" />;
  if (error || !invoice) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  async function recordPayment() {
    setPayBusy(true);
    setPayError(null);
    try {
      await api.payInvoice(id);
      reload();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : String(e));
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={invoice.id}
        subtitle={`Issued ${ymdToDisplay(invoice.issued)}`}
        actions={
          !invoice.paid ? (
            <Button onClick={recordPayment} busy={payBusy}>
              <BadgePoundSterling className="h-4 w-4" aria-hidden />
              Record payment
            </Button>
          ) : undefined
        }
      />
      {payError && <p className="text-sm font-medium text-rose-600">{payError}</p>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customer
            </p>
            <Link
              to={`/customers/${invoice.customerId}`}
              className="mt-1 block text-sm font-medium text-brand-600 hover:underline"
            >
              {invoice.customerName}
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SourceBadge source={invoice.source} />
              <PaidBadge paid={invoice.paid} />
              {invoice.paid && invoice.paidOn && (
                <span className="text-xs text-slate-500">
                  Paid on {ymdToDisplay(invoice.paidOn)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
              {invoice.display}
            </p>
            {invoice.outstandingPence > 0 && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {formatPence(invoice.outstandingPence)} outstanding
              </p>
            )}
          </div>
        </div>
      </Card>

      {!invoice.vatConfirmed && (
        <AmberBanner>
          VAT classification is provisional &mdash; awaiting Finance sign-off
        </AmberBanner>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Lines</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Kind</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Unit</Th>
                <Th align="right">Line total</Th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <Td className="text-slate-900">{line.description}</Td>
                  <Td>
                    <Badge tone="slate" outline>
                      {line.kind === 'SUPPLY' ? 'Supply' : 'Service'}
                    </Badge>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {line.quantity}
                  </Td>
                  <Td money>{formatPence(line.unitPence)}</Td>
                  <Td money>{formatPence(line.quantity * line.unitPence)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">VAT breakdown</h2>
          <div className="space-y-2">
            {invoice.bands.map((band) => (
              <div
                key={band.liability}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="text-sm text-slate-600">
                  {bandLabel(band.liability, band.ratePercent)}
                </span>
                <span className="text-sm tabular-nums text-slate-700">
                  net {formatPence(band.net)}
                  <span className="mx-1.5 text-slate-300">·</span>
                  VAT <span className="font-medium">{formatPence(band.vat)}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Net</span>
              <span className="tabular-nums font-medium">{invoice.displayNet}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>VAT</span>
              <span className="tabular-nums font-medium">{invoice.displayVat}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{invoice.display}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium tabular-nums text-slate-900">{p.display}</p>
                    <p className="text-xs text-slate-500">
                      Paid {ymdToDisplay(p.paidOn)} &middot; recorded {ukDateTime(p.recordedAt)}
                    </p>
                  </div>
                  <Badge tone="emerald">Received</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

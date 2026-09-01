import { Link } from 'react-router-dom';
import { api, useFetch } from '../lib/api';
import { ymdToDisplay } from '../lib/format';
import { Card, EmptyState, ErrorState, PageHeader, Spinner, Td, Th } from '../components/ui';
import { PaidBadge, SourceBadge } from '../components/domain';

export default function Invoices() {
  const { data: invoices, loading, error, reload } = useFetch(() => api.invoices(), []);

  if (loading) return <Spinner label="Loading invoices…" />;
  if (error || !invoices) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  const unpaid = invoices.filter((i) => !i.paid).length;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'} · ${unpaid} unpaid`}
      />
      <Card>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices" hint="Issued invoices will appear here." />
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

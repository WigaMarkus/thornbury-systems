import { useNavigate } from 'react-router-dom';
import { api, useFetch } from '../lib/api';
import { Card, EmptyState, ErrorState, PageHeader, Spinner, Td, Th } from '../components/ui';
import { AccountTypeBadge, VatBadge } from '../components/domain';

export default function Customers() {
  const navigate = useNavigate();
  const { data: customers, loading, error, reload } = useFetch(() => api.customers(), []);

  if (loading) return <Spinner label="Loading customers…" />;
  if (error || !customers) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} account${customers.length === 1 ? '' : 's'} on the ledger`}
      />
      <Card>
        {customers.length === 0 ? (
          <EmptyState title="No customers" hint="Customer accounts will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Address</Th>
                  <Th>Account</Th>
                  <Th>VAT</Th>
                  <Th align="right">Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <Td className="font-medium text-slate-900">{c.name}</Td>
                    <Td className="text-slate-600">{c.address}</Td>
                    <Td>
                      <AccountTypeBadge type={c.accountType} />
                    </Td>
                    <Td>
                      <VatBadge confirmed={c.supplyVatConfirmed} />
                    </Td>
                    <Td money className={c.outstandingPence > 0 ? 'text-rose-600' : 'text-slate-500'}>
                      {c.outstanding}
                    </Td>
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

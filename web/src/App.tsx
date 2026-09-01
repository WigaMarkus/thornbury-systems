import { Route, Routes, Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Layout from './components/Layout';
import { Card } from './components/ui';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Scheduling from './pages/Scheduling';

function NotFound() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <Compass className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">
        That page doesn&rsquo;t exist. Try the dashboard instead.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex rounded-lg bg-navy-800 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-navy-900"
      >
        Back to dashboard
      </Link>
    </Card>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

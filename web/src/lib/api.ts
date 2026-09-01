import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CreateWorkOrderInput,
  CreateWorkOrderResult,
  Customer,
  DispatchPreview,
  DispatchRunResult,
  Engineer,
  Invoice,
  InvoiceDetail,
  InvoiceListItem,
  PayInvoiceResult,
  Slot,
  Statement,
  WorkOrder,
} from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error('Could not reach the Thornbury Systems API. Is the server running?');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body (e.g. a 500 crash page) — fall through to status error
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  customers: () => req<Customer[]>('/customers'),
  customer: (id: string) => req<Customer>(`/customers/${encodeURIComponent(id)}`),
  customerInvoices: (id: string) => req<Invoice[]>(`/customers/${encodeURIComponent(id)}/invoices`),
  statement: (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return req<Statement>(`/customers/${encodeURIComponent(id)}/statement${qs ? `?${qs}` : ''}`);
  },
  invoices: () => req<InvoiceListItem[]>('/invoices'),
  invoice: (id: string) => req<InvoiceDetail>(`/invoices/${encodeURIComponent(id)}`),
  payInvoice: (id: string) =>
    req<PayInvoiceResult>(`/invoices/${encodeURIComponent(id)}/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  engineers: () => req<Engineer[]>('/engineers'),
  workOrders: () => req<WorkOrder[]>('/work-orders'),
  createWorkOrder: (input: CreateWorkOrderInput) =>
    req<CreateWorkOrderResult>('/work-orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  dispatchPreview: () => req<DispatchPreview>('/dispatch'),
  dispatchRun: () => req<DispatchRunResult>('/dispatch/run', { method: 'POST' }),
  dispatchReset: () => req<{ requeued: number }>('/dispatch/reset', { method: 'POST' }),
  slots: () => req<Slot[]>('/slots'),
};

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// The single data pattern: every page uses one useFetch (multi-fetch pages wrap
// their calls in a Promise.all inside fn).
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload };
}

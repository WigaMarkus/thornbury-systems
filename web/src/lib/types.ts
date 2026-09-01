export type AccountType = 'DOMESTIC' | 'COMMERCIAL';
export type VatLiability = 'ZERO_RATED' | 'STANDARD_RATED';
export type InvoiceSource = 'WEB' | 'BATCH' | 'LEGACY_PAPER';
export type WorkOrderStatus = 'QUEUED' | 'DISPATCHED' | 'DONE';

export interface Customer {
  id: string;
  name: string;
  address: string;
  accountType: AccountType;
  vatRegistered: boolean;
  supplyVatLiability: VatLiability;
  supplyVatConfirmed: boolean;
  outstandingPence: number;
  outstanding: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPence: number;
  kind: 'SUPPLY' | 'SERVICE';
}

export interface Invoice {
  id: string;
  customerId: string;
  issued: string; // YYYY-MM-DD
  source: InvoiceSource;
  paid: boolean;
  paidOn: string | null;
  lines: InvoiceLine[];
  totalPence: number;
  display: string;
}

export interface InvoiceListItem extends Invoice {
  customerName: string;
}

export interface VatBand {
  liability: VatLiability;
  ratePercent: number;
  net: number;
  vat: number;
}

export interface Payment {
  id: string;
  amountPence: number;
  paidOn: string;
  recordedAt: string;
  display: string;
}

export interface InvoiceDetail extends Invoice {
  customerName: string;
  net: number;
  vat: number;
  total: number;
  bands: VatBand[];
  vatConfirmed: boolean;
  displayNet: string;
  displayVat: string;
  outstandingPence: number;
  payments: Payment[];
}

export interface StatementLine {
  invoiceId: string;
  issued: string;
  source: InvoiceSource;
  paid: boolean;
  net: number;
  vat: number;
  total: number;
  bands: VatBand[];
  vatConfirmed: boolean;
  outstanding: number;
  display: { net: string; vat: string; total: string; outstanding: string };
}

export interface Statement {
  customer: Customer;
  period: { from: string; to: string };
  broughtForward: number;
  lines: StatementLine[];
  netInPeriod: number;
  vatInPeriod: number;
  invoicedInPeriod: number;
  closingBalance: number;
  vatConfirmed: boolean;
  display: {
    broughtForward: string;
    netInPeriod: string;
    vatInPeriod: string;
    invoicedInPeriod: string;
    closingBalance: string;
  };
}

export interface Engineer {
  id: string;
  name: string;
  skills: string[];
  activeOrders: number;
}

export interface WorkOrder {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  requires: string;
  requestedAt: string;
  durationMinutes: number;
  status: WorkOrderStatus;
  engineerId?: string | null;
}

export interface Slot {
  workOrderId: string;
  window: string;
  date: string;
}

export interface Assignment {
  workOrderId: string;
  engineerId: string;
  engineerName: string;
  customerId: string;
  customerName: string;
  address: string;
  requires: string;
  startsAt: string;
  endsAt: string;
  window: string;
  date: string;
}

export type UnassignedReason = 'DUPLICATE_VISIT' | 'NO_ENGINEER_WITH_SKILL';

export interface Unassigned {
  workOrderId: string;
  reason: UnassignedReason;
}

export interface DispatchPreview {
  assignments: Assignment[];
  unassigned: Unassigned[];
}

export interface DispatchRunResult extends DispatchPreview {
  dispatchedCount: number;
}

export interface CreateWorkOrderInput {
  customerId: string;
  address: string;
  requires: string;
  requestedAt: string;
  durationMinutes: number;
}

export interface CreateWorkOrderResult {
  workOrder: WorkOrder;
  warnings: string[];
}

export interface PayInvoiceResult {
  payment: Payment;
  invoice: InvoiceDetail;
}

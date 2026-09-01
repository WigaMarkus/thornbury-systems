import { engineers, type Engineer, type WorkOrder } from '../db.ts';
import { sameUkDay } from '../shared/dates.ts';
import { normaliseAddress } from './address.ts';

export interface Assignment {
  workOrderId: string;
  engineerId: string;
  address: string;
  startsAt: string;
}

function canDo(engineer: Engineer, order: WorkOrder): boolean {
  return engineer.skills.includes(order.requires);
}

// One visit per address per day. Sending two vans to the same house on the same
// morning is the single biggest source of complaints on the support queue.
//
// The addresses are compared normalised, not as typed: the call takers enter them
// by hand, so the same house arrives as '14 Ashfield Row, Bristol' on one order
// and '14 ashfield row, bristol' on the next, and comparing the raw strings let
// both through.
//
// The day is the UK day, not the UTC day. This was the second half of W-4412
// (JOB D): with a UTC day, Trelawney's 23:30Z backflow test counted as the same
// day as their 09:00Z one and was dropped from the plan, so nobody would have
// turned up at all. By the rule in address.ts, silently dropping a real visit is
// worse than the duplicate this check exists to prevent.
function alreadyVisiting(address: string, when: Date, planned: Assignment[]): boolean {
  const key = normaliseAddress(address);
  return planned.some(
    (a) => normaliseAddress(a.address) === key && sameUkDay(new Date(a.startsAt), when),
  );
}

export type UnassignedReason = 'DUPLICATE_VISIT' | 'NO_ENGINEER_WITH_SKILL';

export interface Unassigned {
  workOrderId: string;
  reason: UnassignedReason;
}

export interface DispatchResult {
  assignments: Assignment[];
  unassigned: Unassigned[];
}

// Same loop as dispatch() always ran, but the two reasons an order is passed
// over are reported instead of silently dropped. Orders that are not QUEUED are
// skipped without comment: they are not waiting for a van, so they are neither
// assigned nor unassigned.
export function dispatchDetailed(orders: WorkOrder[]): DispatchResult {
  // Visits already on the road count against the one-visit-per-address-per-day
  // rule too. Without this, the run that rightly suppressed a duplicate forgets
  // it ever existed once the first order is marked DISPATCHED, and the next run
  // sends the second van after all - the same two-vans complaint, one run
  // apart. DONE orders do not count: that visit has happened, and a new order
  // at the same address is a new problem, not a duplicate.
  const committed: Assignment[] = orders
    .filter((o) => o.status === 'DISPATCHED')
    .map((o) => ({
      workOrderId: o.id,
      engineerId: o.engineerId ?? '',
      address: o.address,
      startsAt: o.requestedAt,
    }));

  const planned: Assignment[] = [];
  const unassigned: Unassigned[] = [];

  for (const order of orders) {
    if (order.status !== 'QUEUED') continue;
    const when = new Date(order.requestedAt);

    if (alreadyVisiting(order.address, when, planned) || alreadyVisiting(order.address, when, committed)) {
      unassigned.push({ workOrderId: order.id, reason: 'DUPLICATE_VISIT' });
      continue;
    }

    const engineer = engineers.find((e) => canDo(e, order));
    if (!engineer) {
      unassigned.push({ workOrderId: order.id, reason: 'NO_ENGINEER_WITH_SKILL' });
      continue;
    }

    planned.push({
      workOrderId: order.id,
      engineerId: engineer.id,
      address: order.address,
      startsAt: order.requestedAt,
    });
  }

  return { assignments: planned, unassigned };
}

export function dispatch(orders: WorkOrder[]): Assignment[] {
  return dispatchDetailed(orders).assignments;
}

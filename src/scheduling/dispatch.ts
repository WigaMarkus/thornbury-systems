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

export function dispatch(orders: WorkOrder[]): Assignment[] {
  const planned: Assignment[] = [];

  for (const order of orders) {
    if (order.status !== 'QUEUED') continue;
    const when = new Date(order.requestedAt);

    if (alreadyVisiting(order.address, when, planned)) continue;

    const engineer = engineers.find((e) => canDo(e, order));
    if (!engineer) continue;

    planned.push({
      workOrderId: order.id,
      engineerId: engineer.id,
      address: order.address,
      startsAt: order.requestedAt,
    });
  }

  return planned;
}

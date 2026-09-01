import { engineers, type Engineer, type WorkOrder } from '../db.ts';
import { sameDay } from '../shared/dates.ts';
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
// sameDay is a UTC day. For a visit either side of UK midnight that is not the
// day the customer means, so a genuine out of hours job can still be mistaken for
// a duplicate of the previous day's visit. That belongs with JOB D, which is
// fixing the UTC and UK local split in shared/dates.ts.
function alreadyVisiting(address: string, when: Date, planned: Assignment[]): boolean {
  const key = normaliseAddress(address);
  return planned.some(
    (a) => normaliseAddress(a.address) === key && sameDay(new Date(a.startsAt), when),
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

// Installment-schedule generation and next-due computation.
import { installmentCount, round2 } from './payment';

export interface ScheduleRow {
  sequence: number;
  dueDate: Date;
  amountDue: number; // cumulative amount that should be paid by this installment
}

// Builds the installment schedule for a customer. Due dates are spread evenly
// from creation to the final deadline; without a deadline they default to
// monthly steps. amountDue is cumulative (last row equals the total).
export function buildSchedule(
  total: number,
  plan: string,
  createdAt: Date,
  finalDeadline?: Date | null,
): ScheduleRow[] {
  const count = installmentCount(plan);
  const per = total / count;
  const rows: ScheduleRow[] = [];

  if (finalDeadline) {
    const start = createdAt.getTime();
    const span = Math.max(finalDeadline.getTime() - start, count * 86400000);
    for (let i = 1; i <= count; i++) {
      rows.push({
        sequence: i,
        dueDate: new Date(start + Math.round((span * i) / count)),
        amountDue: round2(Math.min(per * i, total)),
      });
    }
  } else {
    for (let i = 1; i <= count; i++) {
      const d = new Date(createdAt);
      d.setMonth(d.getMonth() + i);
      rows.push({ sequence: i, dueDate: d, amountDue: round2(Math.min(per * i, total)) });
    }
  }
  return rows;
}

export interface NextDue {
  dueDate: Date;
  amount: number; // amount still needed to satisfy this installment
  daysLeft: number; // negative if overdue
  overdue: boolean;
}

// The next unpaid installment given how much has been paid so far.
export function computeNextDue(
  installments: { sequence: number; dueDate: Date; amountDue: number }[],
  amountPaid: number,
  remainingDebt: number,
  now: Date = new Date(),
): NextDue | null {
  if (remainingDebt <= 0 || !installments.length) return null;
  const sorted = [...installments].sort((a, b) => a.sequence - b.sequence);
  const next = sorted.find((i) => round2(amountPaid) < round2(i.amountDue) - 0.001);
  if (!next) return null;
  const due = new Date(next.dueDate);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  return {
    dueDate: next.dueDate,
    amount: round2(Math.min(remainingDebt, next.amountDue - amountPaid)),
    daysLeft,
    overdue: due.getTime() < now.getTime(),
  };
}

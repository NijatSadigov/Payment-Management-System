// Shared helpers for payment-plan math.

// Number of installments implied by a plan string. "full" counts as a single payment.
export function installmentCount(plan: string): number {
  if (plan === 'full') return 1;
  const n = parseInt(plan, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// The suggested amount for the customer's next payment, rounded to 2 decimals
// and never exceeding what is still owed.
export function suggestedNextPayment(
  totalAmount: number,
  remainingDebt: number,
  plan: string,
): number {
  if (remainingDebt <= 0) return 0;
  const per = totalAmount / installmentCount(plan);
  const rounded = Math.round(per * 100) / 100;
  return Math.min(rounded, Math.round(remainingDebt * 100) / 100);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

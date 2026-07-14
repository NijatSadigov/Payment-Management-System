import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { parsePayToken } from '../lib/payToken';
import { campaignPrimaryManagerId } from '../lib/scope';
import { suggestedNextPayment, round2 } from '../lib/payment';
import { computeNextDue } from '../lib/schedule';
import { beginEpayPayment } from './paymentController';

// The effective minimum online payment: the manager-set minimum, or (when unset)
// the suggested next installment. Never above the remaining debt so the final
// smaller payment is always allowed.
function effectiveMin(payMinAmount: number | null, suggested: number, remaining: number): number {
  const base = payMinAmount && payMinAmount > 0 ? payMinAmount : suggested;
  return round2(Math.min(base, remaining));
}

// The manager to credit: the user who sent the link (if a manager), else the
// campaign's assigned manager.
async function resolveCreditManager(
  senderId: number | null,
  campaignId: number,
): Promise<number | null> {
  if (senderId) {
    const u = await prisma.user.findUnique({ where: { id: senderId } });
    if (u && u.role === 'manager') return senderId;
  }
  return campaignPrimaryManagerId(campaignId);
}

// Public, tokenized customer view — no login.
export async function getPublicCustomer(req: Request, res: Response) {
  const parsed = parsePayToken(String(req.params.token));
  if (!parsed) return res.status(404).json({ error: 'Invalid payment link' });

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.customerId },
    include: { campaign: true, installments: true },
  });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // The link dies when the manager cancels it.
  if (!customer.payLinkActive) {
    return res.json({ active: false });
  }

  const payments = await prisma.payment.findMany({
    where: { customerId: customer.id, status: 'completed' },
    orderBy: { paidAt: 'desc' },
    take: 20,
  });

  const suggested = suggestedNextPayment(
    customer.totalAmount,
    customer.remainingDebt,
    customer.paymentPlan,
  );
  const nd = computeNextDue(customer.installments, customer.amountPaid, customer.remainingDebt);

  res.json({
    active: true,
    firstName: customer.firstName,
    lastName: customer.lastName,
    campaignName: customer.campaign?.name ?? null,
    paymentPlan: customer.paymentPlan,
    totalAmount: customer.totalAmount,
    amountPaid: customer.amountPaid,
    remainingDebt: customer.remainingDebt,
    status: customer.status,
    suggestedNextPayment: suggested,
    note: customer.payNote ?? null,
    minAmount: effectiveMin(customer.payMinAmount ?? null, suggested, customer.remainingDebt),
    nextDueDate: nd?.dueDate ?? null,
    nextDueAmount: nd?.amount ?? null,
    daysUntilDue: nd?.daysLeft ?? null,
    overdue: nd?.overdue ?? false,
    payments: payments.map((p) => ({ paidAt: p.paidAt, amount: p.amount, method: p.method })),
  });
}

// Public: a customer starts an online (EPAY) payment on their own balance.
export async function initPublicEpay(req: Request, res: Response) {
  const parsed = parsePayToken(String(req.params.token));
  if (!parsed) return res.status(404).json({ error: 'Invalid payment link' });

  const customer = await prisma.customer.findUnique({ where: { id: parsed.customerId } });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!customer.payLinkActive) {
    return res.status(400).json({ error: 'This payment link is no longer active' });
  }

  const value = round2(Number(req.body?.amount));
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }
  if (value > round2(customer.remainingDebt)) {
    return res.status(400).json({ error: 'Amount cannot exceed the remaining debt' });
  }

  const suggested = suggestedNextPayment(
    customer.totalAmount,
    customer.remainingDebt,
    customer.paymentPlan,
  );
  const min = effectiveMin(customer.payMinAmount ?? null, suggested, customer.remainingDebt);
  if (value < min - 0.001) {
    return res.status(400).json({ error: `Minimum payment is ${min.toFixed(2)} AZN`, minAmount: min });
  }

  const managerId = await resolveCreditManager(parsed.senderId, customer.campaignId);
  const result = await beginEpayPayment(customer.id, value, null, managerId, {
    returnPath: `/pay.html?token=${encodeURIComponent(String(req.params.token))}`,
    language: req.body?.language,
    description: `Payment — ${customer.firstName} ${customer.lastName}`,
  });
  res.status(201).json(result);
}

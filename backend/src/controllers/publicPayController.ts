import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { findCustomerByCode } from '../lib/customerCode';
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

// The manager to credit: the user who created the customer (if a manager),
// else the campaign's assigned manager.
async function resolveCreditManager(
  creatorId: number | null,
  campaignId: number,
): Promise<number | null> {
  if (creatorId) {
    const u = await prisma.user.findUnique({ where: { id: creatorId } });
    if (u && u.role === 'manager') return creatorId;
  }
  return campaignPrimaryManagerId(campaignId);
}

// Failed-lookup throttle so codes (name + a few digits) can't be brute-forced.
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 20;
const failures = new Map<string, { count: number; since: number }>();

function tooManyFailures(ip: string): boolean {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() - f.since > FAIL_WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return f.count >= MAX_FAILS;
}

function recordFailure(ip: string) {
  const f = failures.get(ip);
  if (!f || Date.now() - f.since > FAIL_WINDOW_MS) failures.set(ip, { count: 1, since: Date.now() });
  else f.count++;
}

interface LinkTarget {
  customerId: number;
  creatorId: number | null;
}

// Resolves the customer code in a public link (/p/Sadigov-NS4K7QX).
async function resolveLink(req: Request, res: Response): Promise<LinkTarget | null> {
  const ip = req.ip || 'unknown';
  if (tooManyFailures(ip)) {
    res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    return null;
  }
  const customer = await findCustomerByCode(String(req.params.code || ''));
  const parsed = customer ? { customerId: customer.id, creatorId: customer.createdById ?? null } : null;
  if (!parsed) {
    recordFailure(ip);
    res.status(404).json({ error: 'Invalid payment link' });
  }
  return parsed;
}

// Public customer view by code — no login.
export async function getPublicCustomer(req: Request, res: Response) {
  const parsed = await resolveLink(req, res);
  if (!parsed) return;

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
    code: customer.code,
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
  const parsed = await resolveLink(req, res);
  if (!parsed) return;

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

  const managerId = await resolveCreditManager(parsed.creatorId, customer.campaignId);
  const result = await beginEpayPayment(customer.id, value, null, managerId, {
    returnPath: `/p/${encodeURIComponent(customer.code!)}`,
    language: req.body?.language,
    description: `Payment — ${customer.firstName} ${customer.lastName}`,
  });
  res.status(201).json(result);
}

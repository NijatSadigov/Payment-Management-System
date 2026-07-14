import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { customerScopeFilter, managerCampaignIds } from '../lib/scope';
import { round2 } from '../lib/payment';
import { computeNextDue } from '../lib/schedule';

// Campaign IDs visible to the current user (undefined => all).
async function visibleCampaignIds(req: Request): Promise<number[] | undefined> {
  if (req.user!.role === 'super_admin') return undefined;
  const ids = await managerCampaignIds(req.user!.id);
  return ids.length ? ids : [-1];
}

export async function overview(req: Request, res: Response) {
  const scope = await customerScopeFilter(req.user!);
  const customers = await prisma.customer.findMany({
    where: scope,
    include: { installments: true },
  });

  const totalRevenue = round2(customers.reduce((s, c) => s + c.amountPaid, 0));
  const totalDebt = round2(customers.reduce((s, c) => s + c.remainingDebt, 0));
  const paidCustomers = customers.filter((c) => c.status === 'paid').length;
  const debtCustomers = customers.filter((c) => c.status === 'has_debt').length;
  const overdueCustomers = customers.filter((c) => {
    const nd = computeNextDue(c.installments, c.amountPaid, c.remainingDebt);
    return nd?.overdue;
  }).length;

  res.json({
    totalRevenue,
    totalDebt,
    paidCustomers,
    debtCustomers,
    overdueCustomers,
    totalCustomers: customers.length,
  });
}

export async function byCampaign(req: Request, res: Response) {
  const ids = await visibleCampaignIds(req);
  const campaigns = await prisma.campaign.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: { customers: true },
    orderBy: { name: 'asc' },
  });

  const rows = campaigns.map((c) => {
    const revenue = round2(c.customers.reduce((s, cu) => s + cu.amountPaid, 0));
    const debt = round2(c.customers.reduce((s, cu) => s + cu.remainingDebt, 0));
    return {
      campaignId: c.id,
      campaignName: c.name,
      price: c.price,
      customerCount: c.customers.length,
      revenue,
      debt,
    };
  });

  res.json(rows);
}

export async function byManager(req: Request, res: Response) {
  // Managers only see their own collection totals.
  const managerWhere =
    req.user!.role === 'manager' ? { id: req.user!.id } : { role: 'manager' as const };

  const managers = await prisma.user.findMany({
    where: managerWhere,
    include: { receivedPayments: { where: { status: 'completed' } } },
    orderBy: { firstName: 'asc' },
  });

  const rows = managers.map((m) => ({
    managerId: m.id,
    managerName: `${m.firstName} ${m.lastName}`,
    email: m.email,
    collected: round2(m.receivedPayments.reduce((s, p) => s + p.amount, 0)),
    paymentCount: m.receivedPayments.length,
  }));

  res.json(rows);
}

// Groups a date into a bucket key for the requested period.
function bucketKey(date: Date, period: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (period === 'yearly') return `${y}`;
  if (period === 'monthly') return `${y}-${m}`;
  if (period === 'weekly') {
    // ISO-ish week number.
    const start = new Date(y, 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / 86400000);
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  }
  return `${y}-${m}-${d}`; // daily
}

export async function timeline(req: Request, res: Response) {
  const period = String(req.query.period || 'monthly');
  const ids = await visibleCampaignIds(req);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'completed',
      ...(ids ? { customer: { campaignId: { in: ids } } } : {}),
    },
    orderBy: { paidAt: 'asc' },
  });

  const buckets = new Map<string, number>();
  for (const p of payments) {
    const key = bucketKey(new Date(p.paidAt), period);
    buckets.set(key, round2((buckets.get(key) || 0) + p.amount));
  }

  const rows = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, amount]) => ({ label, amount }));

  res.json({ period, points: rows });
}

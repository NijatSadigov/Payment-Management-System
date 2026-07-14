import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { customerScopeFilter, managerCampaignIds } from '../lib/scope';
import { buildCustomerWhere } from '../lib/customerFilter';
import { installmentCount, suggestedNextPayment, round2 } from '../lib/payment';
import { buildSchedule, computeNextDue } from '../lib/schedule';
import { makePayToken } from '../lib/payToken';

interface CustomerRow {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  campaignId: number;
  paymentPlan: string;
  totalAmount: number;
  amountPaid: number;
  remainingDebt: number;
  lastPaymentDate: Date | null;
  status: string;
  createdAt: Date;
  payNote?: string | null;
  payMinAmount?: number | null;
  payLinkActive?: boolean;
  campaign?: { id: number; name: string };
  installments?: { sequence: number; dueDate: Date; amountDue: number }[];
}

// viewerId is embedded into the pay link so self-service payments made via a
// link credit the user who generated/sent it.
function serialize(customer: CustomerRow, viewerId: number | null) {
  const installments = (customer.installments || []).sort((a, b) => a.sequence - b.sequence);
  const nd = computeNextDue(installments, customer.amountPaid, customer.remainingDebt);

  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    campaignId: customer.campaignId,
    campaignName: customer.campaign?.name ?? null,
    paymentPlan: customer.paymentPlan,
    totalAmount: customer.totalAmount,
    amountPaid: customer.amountPaid,
    remainingDebt: customer.remainingDebt,
    lastPaymentDate: customer.lastPaymentDate,
    status: customer.status,
    createdAt: customer.createdAt,
    suggestedNextPayment: suggestedNextPayment(
      customer.totalAmount,
      customer.remainingDebt,
      customer.paymentPlan,
    ),
    payToken: makePayToken(customer.id, viewerId),
    payNote: customer.payNote ?? null,
    payMinAmount: customer.payMinAmount ?? null,
    payLinkActive: customer.payLinkActive ?? true,
    // Next payment due (for the main-screen deadline tracking).
    nextDueDate: nd?.dueDate ?? null,
    nextDueAmount: nd?.amount ?? null,
    daysUntilDue: nd?.daysLeft ?? null,
    overdue: nd?.overdue ?? false,
    installmentsTotal: installments.length,
    installmentsPaid: installments.filter(
      (i) => round2(customer.amountPaid) >= round2(i.amountDue) - 0.001,
    ).length,
    schedule: installments.map((i) => ({
      sequence: i.sequence,
      dueDate: i.dueDate,
      amountDue: i.amountDue,
      paid: round2(customer.amountPaid) >= round2(i.amountDue) - 0.001,
    })),
  };
}

const includeRels = { campaign: true, installments: true } as const;

export async function listCustomers(req: Request, res: Response) {
  const where = await buildCustomerWhere(req.user!, req.query);
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: includeRels,
  });
  res.json(customers.map((c) => serialize(c, req.user!.id)));
}

export async function getCustomer(req: Request, res: Response) {
  const id = Number(req.params.id);
  const scope = await customerScopeFilter(req.user!);
  const customer = await prisma.customer.findFirst({
    where: { id, ...scope },
    include: includeRels,
  });
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(serialize(customer, req.user!.id));
}

export async function createCustomer(req: Request, res: Response) {
  const { firstName, lastName, phone, campaignId, paymentPlan, finalDeadline } = req.body || {};
  if (!firstName || !lastName || !phone || !campaignId || !paymentPlan) {
    return res
      .status(400)
      .json({ error: 'firstName, lastName, phone, campaignId and paymentPlan are required' });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: Number(campaignId) } });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  if (req.user!.role === 'manager') {
    const ids = await managerCampaignIds(req.user!.id);
    if (!ids.includes(Number(campaignId))) {
      return res.status(403).json({ error: 'You are not assigned to this campaign' });
    }
  }

  const plan = String(paymentPlan);
  const count = installmentCount(plan);
  if (plan !== 'full' && count > campaign.maxInstallments) {
    return res
      .status(400)
      .json({ error: `This campaign allows at most ${campaign.maxInstallments} installments` });
  }

  let deadline: Date | null = null;
  if (finalDeadline) {
    deadline = new Date(String(finalDeadline));
    deadline.setHours(23, 59, 59, 999);
  }

  const total = round2(campaign.price);
  const customer = await prisma.customer.create({
    data: {
      firstName,
      lastName,
      phone,
      campaignId: Number(campaignId),
      paymentPlan: plan,
      totalAmount: total,
      amountPaid: 0,
      remainingDebt: total,
      status: total <= 0 ? 'paid' : 'has_debt',
    },
  });

  // Generate the installment schedule.
  const rows = buildSchedule(total, plan, customer.createdAt, deadline);
  await prisma.installment.createMany({
    data: rows.map((r) => ({
      customerId: customer.id,
      sequence: r.sequence,
      dueDate: r.dueDate,
      amountDue: r.amountDue,
    })),
  });

  const full = await prisma.customer.findUnique({ where: { id: customer.id }, include: includeRels });
  res.status(201).json(serialize(full!, req.user!.id));
}

export async function updateCustomer(req: Request, res: Response) {
  const id = Number(req.params.id);
  const scope = await customerScopeFilter(req.user!);
  const customer = await prisma.customer.findFirst({ where: { id, ...scope } });
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const { firstName, lastName, phone, payNote, payMinAmount, payLinkActive } = req.body || {};
  const data: Record<string, unknown> = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (phone !== undefined) data.phone = phone;
  if (payLinkActive !== undefined) data.payLinkActive = !!payLinkActive;

  // Payment-link settings (null / empty clears them).
  if (payNote !== undefined) data.payNote = payNote ? String(payNote) : null;
  if (payMinAmount !== undefined) {
    const n = Number(payMinAmount);
    data.payMinAmount =
      payMinAmount === null || payMinAmount === '' || !Number.isFinite(n) || n <= 0
        ? null
        : round2(n);
  }

  const updated = await prisma.customer.update({
    where: { id },
    data,
    include: includeRels,
  });

  res.json(serialize(updated, req.user!.id));
}

// Update the due dates of a customer's installment schedule.
export async function updateSchedule(req: Request, res: Response) {
  const id = Number(req.params.id);
  const scope = await customerScopeFilter(req.user!);
  const customer = await prisma.customer.findFirst({ where: { id, ...scope } });
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const items = Array.isArray(req.body?.installments) ? req.body.installments : [];
  await prisma.$transaction(
    items
      .filter((it: { sequence: number; dueDate: string }) => it && it.dueDate)
      .map((it: { sequence: number; dueDate: string }) => {
        const d = new Date(String(it.dueDate));
        d.setHours(23, 59, 59, 999);
        return prisma.installment.updateMany({
          where: { customerId: id, sequence: Number(it.sequence) },
          data: { dueDate: d },
        });
      }),
  );

  const updated = await prisma.customer.findUnique({ where: { id }, include: includeRels });
  res.json(serialize(updated!, req.user!.id));
}

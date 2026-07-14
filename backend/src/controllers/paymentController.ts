import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { customerScopeFilter } from '../lib/scope';
import { round2 } from '../lib/payment';
import {
  generateOrderRef,
  sandboxCheckoutUrl,
  signCallback,
  verifyCallback,
  epayInfo,
} from '../lib/epay';
import { createOnlinePayment, verifyEpointCallback, decodeCallback } from '../lib/epoint';
import { config } from '../config';

export interface EpayContext {
  returnPath?: string;
  language?: string;
  description?: string;
}

// ---- Payment history ----
export async function listPayments(req: Request, res: Response) {
  const customerId = Number(req.params.id);
  const scope = await customerScopeFilter(req.user!);
  const customer = await prisma.customer.findFirst({ where: { id: customerId, ...scope } });
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const payments = await prisma.payment.findMany({
    where: { customerId },
    orderBy: { paidAt: 'desc' },
    include: { receivedBy: true },
  });

  res.json(
    payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      paidAt: p.paidAt,
      note: p.note,
      // null receiver => customer self-service (online). Frontend localizes.
      receivedBy: p.receivedBy ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}` : null,
      selfService: !p.receivedByManagerId,
      receivedByManagerId: p.receivedByManagerId,
    })),
  );
}

// Shared: create a PENDING online payment and return where to send the payer.
// receivedByManagerId is null for customer self-service payments.
// Sandbox → local simulated gateway page. Live → Epoint hosted payment page.
export async function beginEpayPayment(
  customerId: number,
  value: number,
  note: string | null,
  receivedByManagerId: number | null,
  ctx: EpayContext = {},
) {
  const orderRef = generateOrderRef();
  const payment = await prisma.payment.create({
    data: {
      customerId,
      amount: value,
      method: 'epay',
      status: 'pending',
      providerRef: orderRef,
      note,
      receivedByManagerId,
    },
  });

  const returnPath = ctx.returnPath || '/customers.html';
  let redirectUrl: string;

  if (epayInfo.sandbox) {
    redirectUrl = sandboxCheckoutUrl(orderRef, returnPath);
  } else {
    // Live Epoint: create the payment and get its hosted-page URL.
    const sep = returnPath.includes('?') ? '&' : '?';
    const back = (r: string) => `${config.appBaseUrl}${returnPath}${sep}epay=${r}`;
    try {
      const created = await createOnlinePayment({
        orderRef,
        amount: value,
        description: ctx.description || `Payment #${orderRef}`,
        language: ctx.language || 'az',
        successUrl: back('success'),
        errorUrl: back('declined'),
      });
      redirectUrl = created.redirectUrl;
    } catch (e) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
      throw e;
    }
  }

  return {
    orderRef,
    paymentId: payment.id,
    amount: value,
    checkoutUrl: redirectUrl,
    sandbox: epayInfo.sandbox,
  };
}

// Validates a payment amount against the customer's remaining debt.
function validateAmount(value: number, remainingDebt: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return 'Amount must be greater than 0';
  if (value > round2(remainingDebt)) return 'Amount cannot exceed the remaining debt';
  return null;
}

// Applies a completed payment to the customer's running totals (atomic).
async function applyCompletedPayment(paymentId: number, customerId: number, amount: number) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const newPaid = round2(customer.amountPaid + amount);
  const newDebt = round2(customer.remainingDebt - amount);
  const now = new Date();
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'completed', paidAt: now },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: {
        amountPaid: newPaid,
        remainingDebt: newDebt,
        lastPaymentDate: now,
        status: newDebt <= 0 ? 'paid' : 'has_debt',
      },
    }),
  ]);
}

// ---- Cash / in-person payment (immediate) ----
export async function createPayment(req: Request, res: Response) {
  const customerId = Number(req.params.id);
  const { amount, note } = req.body || {};

  const scope = await customerScopeFilter(req.user!);
  const customer = await prisma.customer.findFirst({ where: { id: customerId, ...scope } });
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const value = round2(Number(amount));
  const err = validateAmount(value, customer.remainingDebt);
  if (err) return res.status(400).json({ error: err });

  const newPaid = round2(customer.amountPaid + value);
  const newDebt = round2(customer.remainingDebt - value);
  const now = new Date();

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        customerId,
        amount: value,
        method: 'cash',
        status: 'completed',
        note: note ? String(note) : null,
        receivedByManagerId: req.user!.id,
        paidAt: now,
      },
      include: { receivedBy: true },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: {
        amountPaid: newPaid,
        remainingDebt: newDebt,
        lastPaymentDate: now,
        status: newDebt <= 0 ? 'paid' : 'has_debt',
      },
    }),
  ]);

  res.status(201).json({
    id: payment.id,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    paidAt: payment.paidAt,
    customer: { amountPaid: newPaid, remainingDebt: newDebt, status: newDebt <= 0 ? 'paid' : 'has_debt' },
  });
}

// ---- EPAY: initiate an online payment ----
// Creates a PENDING payment and returns where to send the payer. Customer
// totals are NOT touched until the gateway confirms via the callback.
export async function initEpayPayment(req: Request, res: Response) {
  const customerId = Number(req.params.id);
  const { amount, note, returnPath, language } = req.body || {};

  const scope = await customerScopeFilter(req.user!);
  const customer = await prisma.customer.findFirst({ where: { id: customerId, ...scope } });
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const value = round2(Number(amount));
  const err = validateAmount(value, customer.remainingDebt);
  if (err) return res.status(400).json({ error: err });

  const result = await beginEpayPayment(customerId, value, note ? String(note) : null, req.user!.id, {
    returnPath: returnPath || `/customer.html?id=${customerId}`,
    language,
    description: `Payment — ${customer.firstName} ${customer.lastName}`,
  });
  res.status(201).json(result);
}

// ---- EPAY: order lookup (public — used by the hosted checkout page) ----
export async function getEpayOrder(req: Request, res: Response) {
  const ref = String(req.params.ref);
  const payment = await prisma.payment.findFirst({
    where: { providerRef: ref, method: 'epay' },
    include: { customer: { include: { campaign: true } } },
  });
  if (!payment) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({
    orderRef: ref,
    amount: payment.amount,
    currency: epayInfo.currency,
    status: payment.status,
    merchant: epayInfo.merchantId,
    customerName: `${payment.customer.firstName} ${payment.customer.lastName}`,
    campaignName: payment.customer.campaign?.name ?? null,
    customerId: payment.customerId,
  });
}

// Shared: process a gateway callback outcome for an order (idempotent).
async function processOutcome(orderRef: string, success: boolean): Promise<'ok' | 'declined' | 'notfound'> {
  const payment = await prisma.payment.findFirst({
    where: { providerRef: orderRef, method: 'epay' },
  });
  if (!payment) return 'notfound';
  if (payment.status !== 'pending') return 'ok'; // already settled — idempotent

  if (!success) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    return 'declined';
  }

  // Re-validate against current debt in case it changed while pending.
  const customer = await prisma.customer.findUnique({ where: { id: payment.customerId } });
  if (!customer || round2(payment.amount) > round2(customer.remainingDebt)) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    return 'declined';
  }

  await applyCompletedPayment(payment.id, payment.customerId, round2(payment.amount));
  return 'ok';
}

// ---- EPAY: gateway callback (public, signature-verified) ----
// This is the server-to-server endpoint the real gateway calls. It trusts the
// request only if the signature matches.
export async function epayCallback(req: Request, res: Response) {
  const { order, status, signature } = req.body || {};
  if (!order || !status) {
    return res.status(400).json({ error: 'Missing order or status' });
  }
  if (!verifyCallback({ order: String(order), status: String(status) }, String(signature || ''))) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  const result = await processOutcome(String(order), String(status) === 'success');
  if (result === 'notfound') return res.status(404).json({ error: 'Order not found' });
  res.json({ received: true, result });
}

// ---- Epoint: live gateway callback (public, signature-verified) ----
// The real Epoint result URL. Epoint POSTs { data, signature } where data is
// base64(JSON) containing order_id and status.
export async function epointCallback(req: Request, res: Response) {
  const { data, signature } = req.body || {};
  if (!data || !signature) {
    return res.status(400).json({ error: 'Missing data or signature' });
  }
  if (!verifyEpointCallback(String(data), String(signature))) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  const decoded = decodeCallback(String(data));
  const orderRef = decoded?.order_id;
  const status = String(decoded?.status || '');
  if (!orderRef) {
    return res.status(400).json({ error: 'Missing order_id' });
  }
  const result = await processOutcome(String(orderRef), status === 'success');
  if (result === 'notfound') return res.status(404).json({ error: 'Order not found' });
  res.json({ received: true });
}

// ---- EPAY: sandbox "pay" action (public, sandbox only) ----
// Stands in for the real gateway: it signs a callback exactly as the gateway
// would and runs it through the same verified path.
export async function epaySandboxComplete(req: Request, res: Response) {
  if (!config.epoint.sandbox) {
    return res.status(403).json({ error: 'Sandbox disabled' });
  }
  const { ref, outcome } = req.body || {};
  if (!ref) return res.status(400).json({ error: 'Missing ref' });

  const status = outcome === 'fail' ? 'failed' : 'success';
  const fields = { order: String(ref), status };
  const signature = signCallback(fields);
  const result = await processOutcome(String(ref), status === 'success');
  if (result === 'notfound') return res.status(404).json({ error: 'Order not found' });

  // Echo the signature back so the flow mirrors a real gateway callback.
  res.json({ ok: result === 'ok', result, signature });
}

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { managerCampaignIds } from '../lib/scope';

function serialize(campaign: {
  id: number;
  name: string;
  price: number;
  maxInstallments: number;
  createdAt: Date;
  managers?: { manager: { id: number; firstName: string; lastName: string } }[];
  _count?: { customers: number };
}) {
  return {
    id: campaign.id,
    name: campaign.name,
    price: campaign.price,
    maxInstallments: campaign.maxInstallments,
    createdAt: campaign.createdAt,
    customerCount: campaign._count?.customers ?? 0,
    managers: (campaign.managers || []).map((m) => ({
      id: m.manager.id,
      firstName: m.manager.firstName,
      lastName: m.manager.lastName,
    })),
  };
}

export async function listCampaigns(req: Request, res: Response) {
  // Managers only see campaigns assigned to them.
  let where: Record<string, unknown> = {};
  if (req.user!.role === 'manager') {
    const ids = await managerCampaignIds(req.user!.id);
    where = { id: { in: ids.length ? ids : [-1] } };
  }

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      managers: { include: { manager: true } },
      _count: { select: { customers: true } },
    },
  });

  res.json(campaigns.map(serialize));
}

export async function createCampaign(req: Request, res: Response) {
  const { name, price, maxInstallments, managerIds } = req.body || {};
  if (!name || price === undefined || maxInstallments === undefined) {
    return res.status(400).json({ error: 'name, price and maxInstallments are required' });
  }
  const max = Number(maxInstallments);
  if (max < 1 || max > 5) {
    return res.status(400).json({ error: 'maxInstallments must be between 1 and 5' });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      price: Number(price),
      maxInstallments: max,
      managers: {
        create: (managerIds || []).map((id: number) => ({ managerId: Number(id) })),
      },
    },
    include: {
      managers: { include: { manager: true } },
      _count: { select: { customers: true } },
    },
  });

  res.status(201).json(serialize(campaign));
}

export async function updateCampaign(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { name, price, maxInstallments, managerIds } = req.body || {};

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (price !== undefined) data.price = Number(price);
  if (maxInstallments !== undefined) {
    const max = Number(maxInstallments);
    if (max < 1 || max > 5) {
      return res.status(400).json({ error: 'maxInstallments must be between 1 and 5' });
    }
    data.maxInstallments = max;
  }

  if (Array.isArray(managerIds)) {
    await prisma.campaignManager.deleteMany({ where: { campaignId: id } });
    await prisma.campaignManager.createMany({
      data: managerIds.map((mid: number) => ({ campaignId: id, managerId: Number(mid) })),
      skipDuplicates: true,
    });
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data,
    include: {
      managers: { include: { manager: true } },
      _count: { select: { customers: true } },
    },
  });

  res.json(serialize(updated));
}

export async function deleteCampaign(req: Request, res: Response) {
  const id = Number(req.params.id);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  await prisma.campaign.delete({ where: { id } });
  res.json({ success: true });
}

export async function assignManager(req: Request, res: Response) {
  const campaignId = Number(req.params.id);
  const { managerId } = req.body || {};
  if (!managerId) {
    return res.status(400).json({ error: 'managerId is required' });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  const manager = await prisma.user.findFirst({ where: { id: Number(managerId), role: 'manager' } });
  if (!manager) {
    return res.status(404).json({ error: 'Manager not found' });
  }

  await prisma.campaignManager.upsert({
    where: { campaignId_managerId: { campaignId, managerId: Number(managerId) } },
    create: { campaignId, managerId: Number(managerId) },
    update: {},
  });

  res.json({ success: true });
}

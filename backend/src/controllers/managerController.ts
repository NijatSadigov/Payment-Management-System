import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

// Shape returned to the client (never expose the password hash).
function serialize(user: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: Date;
  managedCampaigns?: { campaign: { id: number; name: string } }[];
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    campaigns: (user.managedCampaigns || []).map((m) => m.campaign),
  };
}

export async function listManagers(_req: Request, res: Response) {
  const managers = await prisma.user.findMany({
    where: { role: 'manager' },
    orderBy: { createdAt: 'desc' },
    include: { managedCampaigns: { include: { campaign: true } } },
  });
  res.json(managers.map(serialize));
}

export async function createManager(req: Request, res: Response) {
  const { firstName, lastName, email, password, campaignIds } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'firstName, lastName, email and password are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (existing) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const manager = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email: String(email).toLowerCase(),
      passwordHash,
      role: 'manager',
      managedCampaigns: {
        create: (campaignIds || []).map((id: number) => ({ campaignId: Number(id) })),
      },
    },
    include: { managedCampaigns: { include: { campaign: true } } },
  });

  res.status(201).json(serialize(manager));
}

export async function updateManager(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { firstName, lastName, email, password, campaignIds } = req.body || {};

  const manager = await prisma.user.findFirst({ where: { id, role: 'manager' } });
  if (!manager) {
    return res.status(404).json({ error: 'Manager not found' });
  }

  const data: Record<string, unknown> = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = String(email).toLowerCase();
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  // Replace campaign assignments if provided.
  if (Array.isArray(campaignIds)) {
    await prisma.campaignManager.deleteMany({ where: { managerId: id } });
    await prisma.campaignManager.createMany({
      data: campaignIds.map((cid: number) => ({ managerId: id, campaignId: Number(cid) })),
      skipDuplicates: true,
    });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { managedCampaigns: { include: { campaign: true } } },
  });

  res.json(serialize(updated));
}

export async function deleteManager(req: Request, res: Response) {
  const id = Number(req.params.id);
  const manager = await prisma.user.findFirst({ where: { id, role: 'manager' } });
  if (!manager) {
    return res.status(404).json({ error: 'Manager not found' });
  }
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
}

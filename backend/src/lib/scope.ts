import { prisma } from './prisma';
import { AuthUser } from '../middleware/auth';

// Returns the list of campaign IDs a manager is assigned to.
export async function managerCampaignIds(managerId: number): Promise<number[]> {
  const rows = await prisma.campaignManager.findMany({
    where: { managerId },
    select: { campaignId: true },
  });
  return rows.map((r) => r.campaignId);
}

// The manager to credit for a campaign's self-service payments: the assigned
// manager with the lowest id (deterministic), or null if none is assigned.
export async function campaignPrimaryManagerId(campaignId: number): Promise<number | null> {
  const row = await prisma.campaignManager.findFirst({
    where: { campaignId },
    orderBy: { managerId: 'asc' },
    select: { managerId: true },
  });
  return row ? row.managerId : null;
}

// Builds a Prisma `where` fragment restricting customers to those a user may see.
// Super admins see everything; managers only see customers in their campaigns.
export async function customerScopeFilter(user: AuthUser): Promise<Record<string, unknown>> {
  if (user.role === 'super_admin') return {};
  const ids = await managerCampaignIds(user.id);
  return { campaignId: { in: ids.length ? ids : [-1] } };
}

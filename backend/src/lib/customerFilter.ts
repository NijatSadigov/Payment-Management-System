import { AuthUser } from '../middleware/auth';
import { customerScopeFilter, managerCampaignIds } from './scope';

export interface CustomerQuery {
  campaign?: unknown;
  manager?: unknown;
  status?: unknown;
  name?: unknown;
  phone?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
}

// Builds a Prisma `where` clause for customers from query filters plus role scoping.
// Shared by the customer list endpoint and the export endpoints.
export async function buildCustomerWhere(
  user: AuthUser,
  query: CustomerQuery,
): Promise<Record<string, unknown>> {
  const scope = await customerScopeFilter(user);
  const where: Record<string, unknown> = { ...scope };
  const and: Record<string, unknown>[] = [];

  const { campaign, manager, status, name, phone, dateFrom, dateTo } = query;

  if (campaign) and.push({ campaignId: Number(campaign) });

  if (manager) {
    const ids = await managerCampaignIds(Number(manager));
    and.push({ campaignId: { in: ids.length ? ids : [-1] } });
  }

  if (status === 'paid' || status === 'has_debt') and.push({ status });

  if (name) {
    const term = String(name);
    and.push({
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ],
    });
  }

  if (phone) and.push({ phone: { contains: String(phone) } });

  if (dateFrom || dateTo) {
    const created: Record<string, Date> = {};
    if (dateFrom) created.gte = new Date(String(dateFrom));
    if (dateTo) {
      const end = new Date(String(dateTo));
      end.setHours(23, 59, 59, 999);
      created.lte = end;
    }
    and.push({ createdAt: created });
  }

  if (and.length) where.AND = and;
  return where;
}

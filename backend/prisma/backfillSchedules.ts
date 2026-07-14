// One-off: generate an installment schedule for any customer that has none.
// Safe to re-run (skips customers that already have installments).
import { PrismaClient } from '@prisma/client';
import { buildSchedule } from '../src/lib/schedule';

const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({ include: { installments: true } });
  let created = 0;
  for (const c of customers) {
    if (c.installments.length > 0) continue;
    const rows = buildSchedule(c.totalAmount, c.paymentPlan, c.createdAt, null);
    await prisma.installment.createMany({
      data: rows.map((r) => ({
        customerId: c.id,
        sequence: r.sequence,
        dueDate: r.dueDate,
        amountDue: r.amountDue,
      })),
    });
    created++;
  }
  console.log(`Backfilled schedules for ${created} customer(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

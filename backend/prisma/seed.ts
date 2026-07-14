import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Deterministic-ish pseudo random so seeds look varied but reproducible.
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.campaignManager.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating users...');
  const superAdmin = await prisma.user.create({
    data: {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@system.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'super_admin',
    },
  });

  const manager1 = await prisma.user.create({
    data: {
      firstName: 'Manager',
      lastName: 'One',
      email: 'manager1@system.com',
      passwordHash: await bcrypt.hash('manager1', 10),
      role: 'manager',
    },
  });

  const manager2 = await prisma.user.create({
    data: {
      firstName: 'Manager',
      lastName: 'Two',
      email: 'manager2@system.com',
      passwordHash: await bcrypt.hash('manager2', 10),
      role: 'manager',
    },
  });

  console.log('Creating campaigns...');
  const campaignA = await prisma.campaign.create({
    data: { name: 'Winter Bootcamp', price: 500, maxInstallments: 3 },
  });
  const campaignB = await prisma.campaign.create({
    data: { name: 'Design Masterclass', price: 1200, maxInstallments: 5 },
  });
  const campaignC = await prisma.campaign.create({
    data: { name: 'Weekend Workshop', price: 300, maxInstallments: 2 },
  });

  console.log('Assigning managers to campaigns...');
  // Manager One handles A and C, Manager Two handles B and C.
  await prisma.campaignManager.createMany({
    data: [
      { campaignId: campaignA.id, managerId: manager1.id },
      { campaignId: campaignC.id, managerId: manager1.id },
      { campaignId: campaignB.id, managerId: manager2.id },
      { campaignId: campaignC.id, managerId: manager2.id },
    ],
  });

  const campaignManagers: Record<number, number[]> = {
    [campaignA.id]: [manager1.id],
    [campaignB.id]: [manager2.id],
    [campaignC.id]: [manager1.id, manager2.id],
  };

  const firstNames = [
    'Ali', 'Nigar', 'Rashad', 'Leyla', 'Tural', 'Aysel', 'Elvin', 'Gunel',
    'Kamran', 'Sevda', 'Orxan', 'Nurlan', 'Aida', 'Farid', 'Zaur',
  ];
  const lastNames = [
    'Mammadov', 'Aliyeva', 'Huseynov', 'Guliyeva', 'Ismayilov', 'Karimova',
    'Hasanov', 'Ahmadova', 'Rzayev', 'Suleymanova', 'Babayev', 'Musayeva',
    'Valiyev', 'Aghayeva', 'Najafov',
  ];

  const campaigns = [campaignA, campaignB, campaignC];

  console.log('Creating customers and payments...');
  for (let i = 0; i < 15; i++) {
    const campaign = campaigns[i % campaigns.length];
    const maxInst = campaign.maxInstallments;

    // Choose a valid plan for this campaign.
    const planOptions = ['full'];
    for (let n = 2; n <= maxInst; n++) planOptions.push(String(n));
    const plan = pick(planOptions);

    const total = round2(campaign.price);
    const managerId = pick(campaignManagers[campaign.id]);

    // Decide how much has been paid: some fully paid, some partial, some none.
    const scenario = rand();
    let targetPaid: number;
    if (scenario < 0.35) targetPaid = total; // fully paid
    else if (scenario < 0.8) targetPaid = round2(total * (0.2 + rand() * 0.5)); // partial
    else targetPaid = 0; // untouched

    const customer = await prisma.customer.create({
      data: {
        firstName: firstNames[i],
        lastName: lastNames[i],
        phone: `+99450${String(1000000 + Math.floor(rand() * 8999999))}`,
        campaignId: campaign.id,
        paymentPlan: plan,
        totalAmount: total,
        amountPaid: 0,
        remainingDebt: total,
        status: 'has_debt',
      },
    });

    // Break the target into a few payments over the last ~90 days.
    let paid = 0;
    let lastDate: Date | null = null;
    if (targetPaid > 0) {
      const chunks = plan === 'full' ? 1 : Math.min(installmentsFor(plan), 3);
      const per = round2(targetPaid / chunks);
      for (let c = 0; c < chunks; c++) {
        let amount = c === chunks - 1 ? round2(targetPaid - paid) : per;
        if (amount <= 0) continue;
        const daysAgo = 90 - c * 20 - Math.floor(rand() * 10);
        const paidAt = new Date();
        paidAt.setDate(paidAt.getDate() - Math.max(daysAgo, 1));
        await prisma.payment.create({
          data: {
            customerId: customer.id,
            amount,
            receivedByManagerId: managerId,
            paidAt,
            note: c === 0 ? 'Initial payment' : null,
          },
        });
        paid = round2(paid + amount);
        lastDate = paidAt;
      }
    }

    const remaining = round2(total - paid);
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        amountPaid: paid,
        remainingDebt: remaining,
        lastPaymentDate: lastDate,
        status: remaining <= 0 ? 'paid' : 'has_debt',
      },
    });
  }

  console.log('Seed complete.');
  console.log('Login credentials:');
  console.log('  Super Admin -> admin@system.com / admin123');
  console.log('  Manager One -> manager1@system.com / manager1');
  console.log('  Manager Two -> manager2@system.com / manager2');
}

function installmentsFor(plan: string): number {
  if (plan === 'full') return 1;
  const n = parseInt(plan, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

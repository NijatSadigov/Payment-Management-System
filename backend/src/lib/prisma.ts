import { PrismaClient } from '@prisma/client';

// Prisma's engine starts one thread per CPU core by default. Shared hosts
// (cPanel/CloudLinux) cap threads per account, which makes queries hang, so
// keep the pool small unless configured otherwise.
process.env.TOKIO_WORKER_THREADS ??= '2';

export const prisma = new PrismaClient();

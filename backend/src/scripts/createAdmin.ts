// Creates the super admin account, or resets its password if it already exists.
// Safe on a production database (unlike the seed, it deletes nothing).
//
//   npm run create-admin -- --email you@example.com --password '...' --first Ada --last Lovelace
//
// Each value can instead come from ADMIN_EMAIL / ADMIN_PASSWORD /
// ADMIN_FIRST_NAME / ADMIN_LAST_NAME, which is handy in cPanel's Node.js app
// screen (set them, click "Run JS script" → create-admin, then remove them).
import '../config'; // loads .env
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { userCodeTag } from '../lib/customerCode';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg('email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = arg('password') || process.env.ADMIN_PASSWORD || '';
  const firstName = arg('first') || process.env.ADMIN_FIRST_NAME || 'Admin';
  const lastName = arg('last') || process.env.ADMIN_LAST_NAME || 'Hədəf';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Give a valid email with --email or ADMIN_EMAIL');
  }
  if (password.length < 10) {
    throw new Error('Give a password of at least 10 characters with --password or ADMIN_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role: 'super_admin' },
      })
    : await prisma.user.create({
        data: { email, passwordHash, firstName, lastName, role: 'super_admin' },
      });
  await userCodeTag(user.id);

  console.log(
    existing
      ? `Updated super admin ${email} (password reset).`
      : `Created super admin ${email}.`,
  );
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

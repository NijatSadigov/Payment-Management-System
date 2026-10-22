// Public customer codes, e.g. "Sadigov-NS4K7QX":
//   <Surname> - <2-char creator tag><5 random chars>
// The surname is transliterated to plain Latin so it is easy to type and safe
// in a URL. The creator tag identifies the user who created the customer (see
// User.codeTag). Lookups ignore case and the dash.
import crypto from 'crypto';
import { prisma } from './prisma';
import { campaignPrimaryManagerId } from './scope';

// No 0/O, 1/I/L so codes read back unambiguously over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const TAG_LEN = 2;
const RANDOM_LEN = 5;
const SUFFIX_LEN = TAG_LEN + RANDOM_LEN;
// Tag used when no creator is known; '0' is outside ALPHABET so it can't clash.
const NO_CREATOR_TAG = '00';

const TRANSLIT: Record<string, string> = {
  // Azerbaijani / Turkish
  ə: 'e', ş: 's', ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', İ: 'i',
  // Cyrillic
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'e',
  ғ: 'g', ҹ: 'c', һ: 'h', ө: 'o', ү: 'u', ј: 'y',
};

const MAX_SURNAME = 20;

// "Əliyeva-Şükürova" -> "EliyevaSukurova"
export function surnamePart(raw: string): string {
  const latin = Array.from(String(raw || '').toLowerCase())
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const part = latin
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
    .slice(0, MAX_SURNAME);
  return part || 'Customer';
}

function randomChars(n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

const CODE_RE = new RegExp(`^[A-Za-z0-9]+-[0-9A-Z]{${SUFFIX_LEN}}$`);

export function isCurrentFormat(code: string | null): boolean {
  return !!code && CODE_RE.test(code);
}

// Turns whatever the customer typed ("sadigov ns4k7qx", "SadigovNS4K7QX") into
// the stored form "Sadigov-NS4K7QX" (compared case-insensitively).
export function normalizeCode(input: string): string | null {
  const s = String(input || '').replace(/[^A-Za-z0-9]/g, '');
  if (s.length <= SUFFIX_LEN || s.length > MAX_SURNAME + SUFFIX_LEN) return null;
  return `${s.slice(0, -SUFFIX_LEN)}-${s.slice(-SUFFIX_LEN).toUpperCase()}`;
}

export async function findCustomerByCode(input: string) {
  const code = normalizeCode(input);
  if (!code) return null;
  return prisma.customer.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });
}

// The user's code tag, assigning a new unique one on first use.
export async function userCodeTag(userId: number | null): Promise<string> {
  if (!userId) return NO_CREATOR_TAG;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { codeTag: true } });
  if (!user) return NO_CREATOR_TAG;
  if (user.codeTag) return user.codeTag;
  for (let i = 0; i < 200; i++) {
    const tag = randomChars(TAG_LEN);
    const taken = await prisma.user.findUnique({ where: { codeTag: tag }, select: { id: true } });
    if (taken) continue;
    await prisma.user.update({ where: { id: userId }, data: { codeTag: tag } });
    return tag;
  }
  throw new Error('No free user code tags left');
}

// Generates a unique customer code for a customer created by creatorId.
export async function generateCustomerCode(lastName: string, creatorId: number | null): Promise<string> {
  const base = `${surnamePart(lastName)}-${await userCodeTag(creatorId)}`;
  for (;;) {
    const candidate = base + randomChars(RANDOM_LEN);
    const taken = await prisma.customer.findFirst({
      where: { code: { equals: candidate, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
}

// Runs at startup: gives every user a tag, and gives customers without a
// current-format code a new one. Customers with no recorded creator are
// attributed to their campaign's primary manager.
export async function backfillCustomerCodes(): Promise<void> {
  const users = await prisma.user.findMany({ where: { codeTag: null }, select: { id: true } });
  for (const u of users) await userCodeTag(u.id);

  const customers = await prisma.customer.findMany({
    select: { id: true, code: true, lastName: true, campaignId: true, createdById: true },
  });
  let n = 0;
  for (const c of customers) {
    if (isCurrentFormat(c.code)) continue;
    const creatorId = c.createdById ?? (await campaignPrimaryManagerId(c.campaignId));
    const code = await generateCustomerCode(c.lastName, creatorId);
    await prisma.customer.update({ where: { id: c.id }, data: { code, createdById: creatorId } });
    n++;
  }
  if (n) console.log(`Assigned customer codes to ${n} customer(s)`);
}
